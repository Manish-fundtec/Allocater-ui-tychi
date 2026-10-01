-- One-time fix: per-share NAV was stored as opening_nav with units = 0.
-- Re-run safe: only updates rows where capital > opening_nav and units = 0.
UPDATE investor_nav n
SET
  units = ROUND((pct.capital / NULLIF(n.opening_nav, 0))::numeric, 4),
  opening_nav = pct.capital,
  closing_nav = CASE
    WHEN n.closing_nav IS NULL OR n.closing_nav = n.opening_nav THEN pct.capital
    ELSE n.closing_nav
  END,
  capital = pct.capital,
  updated_at = NOW()
FROM (
  SELECT investor_id, fund_id,
    COALESCE(SUM(subscription_amount - redemption_amount), 0) AS capital
  FROM portal_capital_transactions
  GROUP BY investor_id, fund_id
) pct
WHERE n.investor_id = pct.investor_id
  AND n.fund_id = pct.fund_id
  AND n.nav_source = 'manual'
  AND COALESCE(n.units, 0) = 0
  AND n.opening_nav > 0
  AND pct.capital > n.opening_nav;
