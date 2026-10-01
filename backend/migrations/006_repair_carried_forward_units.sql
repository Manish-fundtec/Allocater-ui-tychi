-- Fix Feb+ rows where carry-forward copied NAV but units stayed 0.
UPDATE investor_nav cur
SET
  units = prev.units,
  capital = prev.capital,
  updated_at = NOW()
FROM investor_nav prev
WHERE cur.fund_id = prev.fund_id
  AND cur.investor_id = prev.investor_id
  AND cur.period > prev.period
  AND prev.period = to_char(
    (to_date(cur.period || '-01', 'YYYY-MM-DD') - interval '1 month'),
    'YYYY-MM'
  )
  AND COALESCE(cur.units, 0) = 0
  AND COALESCE(prev.units, 0) > 0;
