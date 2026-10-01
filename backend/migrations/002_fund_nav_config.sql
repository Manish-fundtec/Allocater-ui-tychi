-- Optional per-fund initial NAV — only when fund has no investor_nav history yet.
-- No bulk seed: you set it manually via PATCH /api/allocator/nav/config
-- OR seed close NAV via POST /api/allocator/nav/seed
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
