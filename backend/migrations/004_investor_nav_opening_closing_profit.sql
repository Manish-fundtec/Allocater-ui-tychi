-- Clear naming: opening_nav (period start) / closing_nav (period end)
-- profit = net profit for the period (set after allocation)

ALTER TABLE investor_nav RENAME COLUMN close_nav TO opening_nav;
ALTER TABLE investor_nav RENAME COLUMN open_nav TO closing_nav;

ALTER TABLE investor_nav
  ADD COLUMN IF NOT EXISTS profit NUMERIC(18, 4);

ALTER TABLE allocation_lines RENAME COLUMN close_nav TO opening_nav;
ALTER TABLE allocation_lines RENAME COLUMN open_nav TO closing_nav;
