-- NAV per share at subscription / period seed; net capital after transaction charges
-- Transaction charges live in allocator tables only (not portal_capital_transactions).

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
