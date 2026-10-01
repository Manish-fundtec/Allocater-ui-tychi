-- Portal investor tables (from Tychi GL migration §39)
-- Run BEFORE 001_allocator.sql if portal_investors does not exist yet.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
