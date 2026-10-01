/**
 * Shared SQL for portal_investors + portal_capital_transactions aggregates.
 *
 * gross_capital  = subscriptions − redemptions (from portal)
 * transaction_charges = allocator investor_capital_adjustments (not portal)
 * net_capital    = gross_capital − transaction_charges
 */

export const PORTAL_CAPITAL_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT
      g.gross_capital,
      COALESCE(a.transaction_charges, 0) AS transaction_charges,
      g.gross_capital - COALESCE(a.transaction_charges, 0) AS capital
    FROM (
      SELECT COALESCE(SUM(pct.subscription_amount - pct.redemption_amount), 0) AS gross_capital
      FROM portal_capital_transactions pct
      WHERE pct.fund_id = i.fund_id AND pct.investor_id = i.investor_id
    ) g
    LEFT JOIN investor_capital_adjustments a
      ON a.investor_id = i.investor_id AND a.fund_id = i.fund_id
  ) cap ON true`;

export const ACTIVE_HAVING = `COALESCE(cap.capital, 0) > 0`;
export const EXITED_HAVING = `COALESCE(cap.capital, 0) <= 0`;

export const PORTAL_INVESTOR_STATUS_SQL = `
  CASE
    WHEN ${ACTIVE_HAVING} THEN 'active'
    ELSE 'exited'
  END`;

export function portalCapitalSubquery(investorParam: string, fundParam: string) {
  return `(
    SELECT
      COALESCE(SUM(pct.subscription_amount - pct.redemption_amount), 0)
      - COALESCE(
          (SELECT transaction_charges FROM investor_capital_adjustments
           WHERE investor_id = ${investorParam} AND fund_id = ${fundParam}),
          0
        )
    FROM portal_capital_transactions pct
    WHERE pct.investor_id = ${investorParam} AND pct.fund_id = ${fundParam}
  )`;
}

export function portalGrossCapitalSubquery(
  investorParam: string,
  fundParam: string,
) {
  return `(
    SELECT COALESCE(SUM(pct.subscription_amount - pct.redemption_amount), 0)
    FROM portal_capital_transactions pct
    WHERE pct.investor_id = ${investorParam} AND pct.fund_id = ${fundParam}
  )`;
}

export function portalTransactionChargesSubquery(
  investorParam: string,
  fundParam: string,
) {
  return `(
    SELECT COALESCE(transaction_charges, 0)
    FROM investor_capital_adjustments
    WHERE investor_id = ${investorParam} AND fund_id = ${fundParam}
  )`;
}
