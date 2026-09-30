-- Tychi Allocator supplemental schema (FundTec shared DB)
-- Run after core funds/investors tables exist.

CREATE TABLE IF NOT EXISTS pl_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES funds(id),
  period VARCHAR(7) NOT NULL,
  net_profit NUMERIC(18,4) NOT NULL,
  gross_revenue NUMERIC(18,4),
  total_expenses NUMERIC(18,4),
  fetched_at TIMESTAMPTZ,
  raw_json JSONB,
  UNIQUE (fund_id, period)
);

CREATE TABLE IF NOT EXISTS investor_nav (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES investors(id),
  fund_id UUID NOT NULL REFERENCES funds(id),
  period VARCHAR(7) NOT NULL,
  close_nav NUMERIC(18,4),
  open_nav NUMERIC(18,4),
  nav_source VARCHAR(20) DEFAULT 'manual',
  units NUMERIC(18,4),
  capital NUMERIC(18,4),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (investor_id, fund_id, period)
);

CREATE TABLE IF NOT EXISTS allocation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES funds(id),
  period VARCHAR(7) NOT NULL,
  pl_report_id UUID REFERENCES pl_reports(id),
  total_profit NUMERIC(18,4),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  run_at TIMESTAMPTZ,
  run_by VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS allocation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES allocation_runs(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES investors(id),
  units NUMERIC(18,4),
  share_pct NUMERIC(8,4),
  gross_profit NUMERIC(18,4),
  mgmt_fee NUMERIC(18,4),
  perf_fee NUMERIC(18,4),
  net_profit NUMERIC(18,4),
  close_nav NUMERIC(18,4),
  open_nav NUMERIC(18,4)
);

CREATE TABLE IF NOT EXISTS nav_report_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES investors(id),
  run_id UUID NOT NULL REFERENCES allocation_runs(id) ON DELETE CASCADE,
  period VARCHAR(7) NOT NULL,
  email_to VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_msg TEXT
);

CREATE TABLE IF NOT EXISTS fee_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES funds(id),
  mgmt_fee_pct NUMERIC(6,2) NOT NULL,
  perf_fee_pct NUMERIC(6,2) NOT NULL,
  hurdle_rate_pct NUMERIC(6,2) NOT NULL,
  frequency VARCHAR(20) NOT NULL,
  effective_from DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES funds(id),
  investor_id UUID NOT NULL REFERENCES investors(id),
  period VARCHAR(7) NOT NULL,
  description TEXT,
  debit NUMERIC(18,4) DEFAULT 0,
  credit NUMERIC(18,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS allocator_settings (
  key VARCHAR(100) PRIMARY KEY,
  value_encrypted TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
