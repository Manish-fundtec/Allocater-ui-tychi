-- ============================================================
-- TYCHI ALLOCATOR — supplemental schema (shared Tychi PostgreSQL)
--
-- Prerequisites (already exist in Tychi DB — DO NOT recreate):
--   funds            PK: fund_id (UUID)
--   portal_investors PK: investor_id (UUID)
--   journals         PK: journal_id (UUID)  — GL journal header
--   journal_lines    PK: line_id (UUID)      — GL journal lines
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- P&L reports (imported from Tychi GL / manual)
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

-- ------------------------------------------------------------
-- Fee structure per fund
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Investor NAV by period (allocator-owned; units/capital snapshotted)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Allocation runs — links to Tychi GL journal when posted
-- ------------------------------------------------------------
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
    error_msg      TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_allocation_status CHECK (status IN ('pending', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_allocation_runs_fund_id ON allocation_runs(fund_id);
CREATE INDEX IF NOT EXISTS idx_allocation_runs_period ON allocation_runs(period);
CREATE INDEX IF NOT EXISTS idx_allocation_runs_status ON allocation_runs(status);
CREATE INDEX IF NOT EXISTS idx_allocation_runs_journal_id ON allocation_runs(journal_id);

-- ------------------------------------------------------------
-- Allocation lines — optional link to Tychi journal_lines
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- NAV report emails
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- App settings (encrypted at rest)
-- NOTE: Do NOT create `journals` here — use existing Tychi GL tables:
--   journals (header) + journal_lines (debit/credit lines)
-- Allocation run posts GL entries there and stores journal_id / journal_line_id.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS allocator_settings (
    key              VARCHAR(100) PRIMARY KEY,
    value_encrypted  TEXT NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------
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

-- Default fee config for every existing fund
INSERT INTO fee_config (fund_id, mgmt_fee_pct, perf_fee_pct, hurdle_rate_pct, frequency, effective_from)
SELECT fund_id, 2.00, 20.00, 8.00, 'monthly', CURRENT_DATE
FROM funds
ON CONFLICT (fund_id, effective_from) DO NOTHING;
