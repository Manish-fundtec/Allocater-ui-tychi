-- ============================================================
-- TYCHI ALLOCATOR — full schema (create + alters)
-- Run on shared Tychi PostgreSQL (needs: funds, journals, journal_lines).
-- Safe to re-run: IF NOT EXISTS / conditional renames.
-- Order matches migrations/000 … 011 (schema only; optional data fixes at end).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- 000 portal (skip if already from Tychi GL §39)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal_investors (
  investor_id UUID PRIMARY KEY,
  external_investor_id VARCHAR(64) NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  fund_id UUID NOT NULL REFERENCES funds(fund_id),
  org_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  full_legal_name VARCHAR(255),
  mailing_address TEXT,
  investor_type VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_investors_fund_id ON portal_investors(fund_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_investors_email_fund ON portal_investors (email, fund_id);

CREATE TABLE IF NOT EXISTS portal_capital_transactions (
  capital_txn_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_transaction_id VARCHAR(64) NOT NULL UNIQUE,
  portal_fund_id VARCHAR(64) NOT NULL,
  fund_id UUID NOT NULL REFERENCES funds(fund_id),
  external_investor_id VARCHAR(64) NOT NULL REFERENCES portal_investors(external_investor_id),
  investor_id UUID REFERENCES portal_investors(investor_id),
  investor_name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  subscription_amount NUMERIC(20, 4) NOT NULL DEFAULT 0,
  redemption_amount NUMERIC(20, 4) NOT NULL DEFAULT 0,
  shares NUMERIC(20, 8),
  class_description VARCHAR(128),
  notes TEXT,
  created_by VARCHAR(255) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  bank_account_code VARCHAR(50),
  bank_id UUID,
  portal_created_at TIMESTAMPTZ,
  portal_updated_at TIMESTAMPTZ,
  sync_status VARCHAR(20) NOT NULL DEFAULT 'synced',
  sync_attempts INT NOT NULL DEFAULT 0,
  last_sync_error TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_capital_txn_fund_id ON portal_capital_transactions(fund_id);
CREATE INDEX IF NOT EXISTS idx_portal_capital_txn_investor_id ON portal_capital_transactions(investor_id);

-- ------------------------------------------------------------
-- 001 allocator core
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pl_reports (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fund_id          UUID NOT NULL REFERENCES funds(fund_id) ON DELETE RESTRICT,
    period           VARCHAR(7) NOT NULL,
    period_label     VARCHAR(50),
    gross_revenue    NUMERIC(18, 4) DEFAULT 0,
    total_expenses   NUMERIC(18, 4) DEFAULT 0,
    net_profit       NUMERIC(18, 4) NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_json         JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pl_reports_fund_period UNIQUE (fund_id, period)
);

CREATE INDEX IF NOT EXISTS idx_pl_reports_fund_id ON pl_reports(fund_id);
CREATE INDEX IF NOT EXISTS idx_pl_reports_period ON pl_reports(period);

CREATE TABLE IF NOT EXISTS fee_config (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fund_id           UUID NOT NULL REFERENCES funds(fund_id) ON DELETE RESTRICT,
    mgmt_fee_pct      NUMERIC(6, 2) NOT NULL DEFAULT 2.00,
    perf_fee_pct      NUMERIC(6, 2) NOT NULL DEFAULT 20.00,
    hurdle_rate_pct   NUMERIC(6, 2) NOT NULL DEFAULT 8.00,
    frequency         VARCHAR(20) NOT NULL DEFAULT 'monthly',
    effective_from    DATE NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fee_config_fund_date UNIQUE (fund_id, effective_from),
    CONSTRAINT chk_fee_config_frequency CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
    CONSTRAINT chk_mgmt_fee_positive CHECK (mgmt_fee_pct >= 0),
    CONSTRAINT chk_perf_fee_positive CHECK (perf_fee_pct >= 0),
    CONSTRAINT chk_hurdle_rate_positive CHECK (hurdle_rate_pct >= 0)
);

CREATE INDEX IF NOT EXISTS idx_fee_config_fund_id ON fee_config(fund_id);

CREATE TABLE IF NOT EXISTS investor_nav (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id   UUID NOT NULL REFERENCES portal_investors(investor_id) ON DELETE RESTRICT,
    fund_id       UUID NOT NULL REFERENCES funds(fund_id) ON DELETE RESTRICT,
    period        VARCHAR(7) NOT NULL,
    close_nav     NUMERIC(18, 4),
    open_nav      NUMERIC(18, 4),
    nav_source    VARCHAR(20) NOT NULL DEFAULT 'manual',
    units         NUMERIC(18, 4),
    capital       NUMERIC(18, 4),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_investor_nav_investor_fund_period UNIQUE (investor_id, fund_id, period),
    CONSTRAINT chk_nav_source CHECK (nav_source IN ('manual', 'auto'))
);

CREATE INDEX IF NOT EXISTS idx_investor_nav_investor_id ON investor_nav(investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_nav_fund_id ON investor_nav(fund_id);
CREATE INDEX IF NOT EXISTS idx_investor_nav_period ON investor_nav(period);

CREATE TABLE IF NOT EXISTS allocation_runs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fund_id        UUID NOT NULL REFERENCES funds(fund_id) ON DELETE RESTRICT,
    pl_report_id   UUID REFERENCES pl_reports(id) ON DELETE RESTRICT,
    period         VARCHAR(7) NOT NULL,
    total_profit   NUMERIC(18, 4),
    status         VARCHAR(30) NOT NULL DEFAULT 'pending',
    run_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    run_by         VARCHAR(100),
    journal_id     UUID REFERENCES journals(journal_id) ON DELETE SET NULL,
    perf_journal_id UUID REFERENCES journals(journal_id) ON DELETE SET NULL,
    pnl_journal_id UUID REFERENCES journals(journal_id) ON DELETE SET NULL,
    error_msg      TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_allocation_status CHECK (status IN ('pending', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_allocation_runs_fund_id ON allocation_runs(fund_id);
CREATE INDEX IF NOT EXISTS idx_allocation_runs_period ON allocation_runs(period);
CREATE INDEX IF NOT EXISTS idx_allocation_runs_status ON allocation_runs(status);
CREATE INDEX IF NOT EXISTS idx_allocation_runs_journal_id ON allocation_runs(journal_id);
CREATE INDEX IF NOT EXISTS idx_allocation_runs_perf_journal_id ON allocation_runs(perf_journal_id);
CREATE INDEX IF NOT EXISTS idx_allocation_runs_pnl_journal_id ON allocation_runs(pnl_journal_id);

CREATE TABLE IF NOT EXISTS allocation_lines (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id           UUID NOT NULL REFERENCES allocation_runs(id) ON DELETE CASCADE,
    investor_id      UUID NOT NULL REFERENCES portal_investors(investor_id) ON DELETE RESTRICT,
    journal_line_id  UUID REFERENCES journal_lines(line_id) ON DELETE SET NULL,
    units            NUMERIC(18, 4),
    share_pct        NUMERIC(8, 4),
    gross_profit     NUMERIC(18, 4),
    mgmt_fee         NUMERIC(18, 4) NOT NULL DEFAULT 0,
    perf_fee         NUMERIC(18, 4) NOT NULL DEFAULT 0,
    net_profit       NUMERIC(18, 4),
    close_nav        NUMERIC(18, 4),
    open_nav         NUMERIC(18, 4),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_allocation_lines_run_investor UNIQUE (run_id, investor_id),
    CONSTRAINT chk_mgmt_fee_non_negative CHECK (mgmt_fee >= 0),
    CONSTRAINT chk_perf_fee_non_negative CHECK (perf_fee >= 0)
);

CREATE INDEX IF NOT EXISTS idx_allocation_lines_run_id ON allocation_lines(run_id);
CREATE INDEX IF NOT EXISTS idx_allocation_lines_investor_id ON allocation_lines(investor_id);
CREATE INDEX IF NOT EXISTS idx_allocation_lines_journal_line_id ON allocation_lines(journal_line_id);

CREATE TABLE IF NOT EXISTS nav_report_emails (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id       UUID NOT NULL REFERENCES portal_investors(investor_id) ON DELETE RESTRICT,
    run_id            UUID NOT NULL REFERENCES allocation_runs(id) ON DELETE CASCADE,
    period            VARCHAR(7) NOT NULL,
    email_to          VARCHAR(255) NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'pending',
    sent_at           TIMESTAMPTZ,
    error_msg         TEXT,
    report_snapshot   JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_nav_emails_run_investor UNIQUE (run_id, investor_id),
    CONSTRAINT chk_nav_email_status CHECK (status IN ('pending', 'sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_nav_report_emails_investor_id ON nav_report_emails(investor_id);
CREATE INDEX IF NOT EXISTS idx_nav_report_emails_run_id ON nav_report_emails(run_id);
CREATE INDEX IF NOT EXISTS idx_nav_report_emails_status ON nav_report_emails(status);

CREATE TABLE IF NOT EXISTS allocator_settings (
    key              VARCHAR(100) PRIMARY KEY,
    value_encrypted  TEXT NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_pl_reports ON pl_reports;
CREATE TRIGGER set_updated_at_pl_reports
    BEFORE UPDATE ON pl_reports
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_investor_nav ON investor_nav;
CREATE TRIGGER set_updated_at_investor_nav
    BEFORE UPDATE ON investor_nav
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

INSERT INTO fee_config (fund_id, mgmt_fee_pct, perf_fee_pct, hurdle_rate_pct, frequency, effective_from)
SELECT fund_id, 2.00, 20.00, 8.00, 'monthly', CURRENT_DATE
FROM funds
ON CONFLICT (fund_id, effective_from) DO NOTHING;

-- ------------------------------------------------------------
-- 002 fund_nav_config
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fund_nav_config (
    fund_id     UUID PRIMARY KEY REFERENCES funds(fund_id) ON DELETE RESTRICT,
    initial_nav NUMERIC(18, 4) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_initial_nav_positive CHECK (initial_nav > 0)
);

DROP TRIGGER IF EXISTS set_updated_at_fund_nav_config ON fund_nav_config;
CREATE TRIGGER set_updated_at_fund_nav_config
    BEFORE UPDATE ON fund_nav_config
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ------------------------------------------------------------
-- 004 rename close_nav/open_nav → opening_nav/closing_nav + profit
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'investor_nav' AND column_name = 'close_nav'
  ) THEN
    ALTER TABLE investor_nav RENAME COLUMN close_nav TO opening_nav;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'investor_nav' AND column_name = 'open_nav'
  ) THEN
    ALTER TABLE investor_nav RENAME COLUMN open_nav TO closing_nav;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'allocation_lines' AND column_name = 'close_nav'
  ) THEN
    ALTER TABLE allocation_lines RENAME COLUMN close_nav TO opening_nav;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'allocation_lines' AND column_name = 'open_nav'
  ) THEN
    ALTER TABLE allocation_lines RENAME COLUMN open_nav TO closing_nav;
  END IF;
END $$;

ALTER TABLE investor_nav
  ADD COLUMN IF NOT EXISTS profit NUMERIC(18, 4);

-- ------------------------------------------------------------
-- 008 nav per share + transaction charges
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS investor_capital_adjustments (
    investor_id          UUID NOT NULL REFERENCES portal_investors(investor_id) ON DELETE RESTRICT,
    fund_id              UUID NOT NULL REFERENCES funds(fund_id) ON DELETE RESTRICT,
    transaction_charges  NUMERIC(18, 4) NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_investor_capital_adjustments PRIMARY KEY (investor_id, fund_id),
    CONSTRAINT chk_transaction_charges_non_negative CHECK (transaction_charges >= 0)
);

DROP TRIGGER IF EXISTS set_updated_at_investor_capital_adjustments ON investor_capital_adjustments;
CREATE TRIGGER set_updated_at_investor_capital_adjustments
    BEFORE UPDATE ON investor_capital_adjustments
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE investor_nav
    ADD COLUMN IF NOT EXISTS nav_per_share NUMERIC(18, 4),
    ADD COLUMN IF NOT EXISTS gross_capital NUMERIC(18, 4),
    ADD COLUMN IF NOT EXISTS transaction_charges NUMERIC(18, 4) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS fund_period_nav (
    fund_id       UUID NOT NULL REFERENCES funds(fund_id) ON DELETE RESTRICT,
    period        VARCHAR(7) NOT NULL,
    nav_per_share NUMERIC(18, 4) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fund_period_nav UNIQUE (fund_id, period),
    CONSTRAINT chk_fund_period_nav_positive CHECK (nav_per_share > 0)
);

DROP TRIGGER IF EXISTS set_updated_at_fund_period_nav ON fund_period_nav;
CREATE TRIGGER set_updated_at_fund_period_nav
    BEFORE UPDATE ON fund_period_nav
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ------------------------------------------------------------
-- 009 dealing_date on portal capital
-- ------------------------------------------------------------
ALTER TABLE portal_capital_transactions
  ADD COLUMN IF NOT EXISTS dealing_date DATE;

UPDATE portal_capital_transactions
SET dealing_date = date
WHERE dealing_date IS NULL;

-- ------------------------------------------------------------
-- 010 performance-fee accrual journal on allocation_runs
-- ------------------------------------------------------------
ALTER TABLE allocation_runs
  ADD COLUMN IF NOT EXISTS perf_journal_id UUID REFERENCES journals(journal_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_allocation_runs_perf_journal_id
  ON allocation_runs(perf_journal_id);

-- ------------------------------------------------------------
-- 011 profit-allocation journal on allocation_runs
-- ------------------------------------------------------------
ALTER TABLE allocation_runs
  ADD COLUMN IF NOT EXISTS pnl_journal_id UUID REFERENCES journals(journal_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_allocation_runs_pnl_journal_id
  ON allocation_runs(pnl_journal_id);
