-- net_profit was stored as income + expense; correct formula is income - expense
UPDATE pl_reports
SET net_profit = COALESCE(gross_revenue, 0) - ABS(COALESCE(total_expenses, 0))
WHERE fetched_at IS NOT NULL;
