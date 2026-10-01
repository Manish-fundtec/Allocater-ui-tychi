-- Effective NAV / mgmt-fee accrual start (Excel dealing date). Falls back to trade date.
ALTER TABLE portal_capital_transactions
  ADD COLUMN IF NOT EXISTS dealing_date DATE;

UPDATE portal_capital_transactions
SET dealing_date = date
WHERE dealing_date IS NULL;
