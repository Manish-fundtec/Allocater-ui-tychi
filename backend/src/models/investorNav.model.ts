import type { PoolClient } from "pg";
import { query, queryOne } from "../db/pool";
import { previousPeriod } from "../lib/periods";
import { periodEndNav } from "../lib/nav/periodNav";
import {
  PORTAL_CAPITAL_LATERAL,
  portalCapitalSubquery,
} from "../lib/portalInvestorSql";

export async function countForFundPeriod(fundId: string, period: string) {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM investor_nav
     WHERE fund_id = $1 AND period = $2`,
    [fundId, period],
  );
  return Number(row?.count ?? 0);
}

export async function listHistory(investorId: string, fundId: string) {
  return query<{
    period: string;
    opening_nav: string;
    closing_nav: string;
    profit: string | null;
    nav_source: string;
    units: string;
    capital: string;
  }>(
    `SELECT period, opening_nav::text, closing_nav::text, profit::text,
            nav_source, units::text, capital::text
     FROM investor_nav
     WHERE investor_id = $1 AND fund_id = $2
     ORDER BY period DESC`,
    [investorId, fundId],
  );
}

export async function getLatestPeriod(fundId: string): Promise<string | null> {
  const row = await queryOne<{ period: string }>(
    `SELECT MAX(period) AS period FROM investor_nav WHERE fund_id = $1`,
    [fundId],
  );
  return row?.period ?? null;
}

export async function getUnitsMapForPeriod(fundId: string, period: string) {
  const rows = await query<{ investor_id: string; units: string }>(
    `SELECT investor_id::text, COALESCE(units, 0)::text AS units
     FROM investor_nav
     WHERE fund_id = $1 AND period = $2`,
    [fundId, period],
  );
  return new Map(
    rows.map((r) => [r.investor_id, Number(r.units)]),
  );
}

export async function getStoredUnits(
  investorId: string,
  fundId: string,
  period: string,
): Promise<number> {
  const row = await queryOne<{ units: string }>(
    `SELECT COALESCE(units, 0)::text AS units
     FROM investor_nav
     WHERE investor_id = $1 AND fund_id = $2 AND period = $3`,
    [investorId, fundId, period],
  );
  return Number(row?.units ?? 0);
}

export async function getLatestFundNavTotals(fundId: string) {
  return queryOne<{
    total_fund_value: string;
    total_units: string;
    period: string;
  }>(
    `SELECT
       COALESCE(SUM(COALESCE(closing_nav, opening_nav)), 0)::text AS total_fund_value,
       COALESCE(SUM(units), 0)::text AS total_units,
       MAX(period) AS period
     FROM investor_nav
     WHERE fund_id = $1
       AND period = (SELECT MAX(period) FROM investor_nav WHERE fund_id = $1)`,
    [fundId],
  );
}

export async function getFundNavTotalsForPeriod(fundId: string, period: string) {
  return queryOne<{
    total_fund_value: string;
    total_units: string;
    period: string;
  }>(
    `SELECT
       COALESCE(SUM(COALESCE(closing_nav, opening_nav)), 0)::text AS total_fund_value,
       COALESCE(SUM(units), 0)::text AS total_units,
       $2::varchar(7) AS period
     FROM investor_nav
     WHERE fund_id = $1 AND period = $2`,
    [fundId, period],
  );
}

export async function listAllForFund(fundId: string) {
  return query<{
    investor_id: string;
    investor_name: string;
    period: string;
    opening_nav: string | null;
    closing_nav: string | null;
    profit: string | null;
    nav_source: string | null;
    capital: string;
  }>(
    `SELECT i.investor_id::text AS investor_id, i.name AS investor_name,
            n.period, n.opening_nav::text, n.closing_nav::text, n.profit::text,
            n.nav_source, cap.capital::text
     FROM investor_nav n
     JOIN portal_investors i ON i.investor_id = n.investor_id
     ${PORTAL_CAPITAL_LATERAL}
     WHERE n.fund_id = $1
     ORDER BY n.period DESC, i.name`,
    [fundId],
  );
}

export async function listForFundPeriod(fundId: string, period: string) {
  return query<{
    investor_id: string;
    investor_name: string;
    period: string;
    opening_nav: string | null;
    closing_nav: string | null;
    profit: string | null;
    nav_source: string | null;
    capital: string;
    gross_capital: string;
    transaction_charges: string;
    units: string | null;
    nav_per_share: string | null;
  }>(
    `SELECT i.investor_id::text AS investor_id, i.name AS investor_name,
            COALESCE(n.period, $2) AS period,
            n.opening_nav::text, n.closing_nav::text, n.profit::text,
            n.nav_source, cap.capital::text, cap.gross_capital::text,
            cap.transaction_charges::text, n.units::text, n.nav_per_share::text
     FROM portal_investors i
     ${PORTAL_CAPITAL_LATERAL}
     LEFT JOIN investor_nav n ON n.investor_id = i.investor_id AND n.fund_id = i.fund_id AND n.period = $2
     WHERE i.fund_id = $1
     ORDER BY i.name`,
    [fundId, period],
  );
}

/** First period / new investor: units = net capital ÷ NAV per share; opening_nav = net capital. */
export async function seedNav(entry: {
  investorId: string;
  fundId: string;
  period: string;
  openingNavTotal: number;
  units: string;
  capital: string;
  navPerShare: number;
  grossCapital: number;
  transactionCharges: number;
}) {
  await query(
    `INSERT INTO investor_nav (
       investor_id, fund_id, period, opening_nav, closing_nav, nav_source,
       units, capital, nav_per_share, gross_capital, transaction_charges, updated_at
     )
     VALUES ($1, $2, $3, $4, $4, 'manual', $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (investor_id, fund_id, period) DO UPDATE SET
       opening_nav = EXCLUDED.opening_nav,
       closing_nav = EXCLUDED.closing_nav,
       units = EXCLUDED.units,
       capital = EXCLUDED.capital,
       nav_per_share = EXCLUDED.nav_per_share,
       gross_capital = EXCLUDED.gross_capital,
       transaction_charges = EXCLUDED.transaction_charges,
       nav_source = 'manual',
       updated_at = NOW()`,
    [
      entry.investorId,
      entry.fundId,
      entry.period,
      entry.openingNavTotal,
      entry.units,
      entry.capital,
      entry.navPerShare,
      entry.grossCapital,
      entry.transactionCharges,
    ],
  );
}

export async function getInvestorPeriodNav(
  investorId: string,
  fundId: string,
  period: string,
) {
  return queryOne<{
    opening_nav: string | null;
    closing_nav: string | null;
    units: string | null;
    nav_per_share: string | null;
  }>(
    `SELECT opening_nav::text, closing_nav::text, units::text, nav_per_share::text
     FROM investor_nav
     WHERE investor_id = $1 AND fund_id = $2 AND period = $3`,
    [investorId, fundId, period],
  );
}

export async function getPreviousPeriodNav(
  investorId: string,
  fundId: string,
  period: string,
) {
  return getInvestorPeriodNav(investorId, fundId, previousPeriod(period));
}

/** Closing NAV per share for a period: total closing NAV ÷ total units. */
export async function getFundClosingNavPerShare(
  fundId: string,
  period: string,
): Promise<number | null> {
  const row = await queryOne<{ nav: string | null }>(
    `SELECT CASE
              WHEN COALESCE(SUM(units), 0) > 0
                THEN (SUM(COALESCE(closing_nav, opening_nav)) / SUM(units))::text
              ELSE NULL
            END AS nav
     FROM investor_nav
     WHERE fund_id = $1 AND period = $2`,
    [fundId, period],
  );
  const n = Number(row?.nav);
  return n > 0 ? n : null;
}

/** Prefer fund_period_nav, then stored investor_nav.nav_per_share. */
export async function getManualNavPerShare(fundId: string, period: string) {
  const periodNav = await queryOne<{ nav_per_share: string }>(
    `SELECT nav_per_share::text FROM fund_period_nav
     WHERE fund_id = $1 AND period = $2`,
    [fundId, period],
  );
  if (periodNav) {
    const n = Number(periodNav.nav_per_share);
    if (n > 0) return n;
  }

  const row = await queryOne<{ nav_per_share: string }>(
    `SELECT MIN(nav_per_share)::text AS nav_per_share
     FROM investor_nav
     WHERE fund_id = $1 AND period = $2 AND nav_per_share > 0
     GROUP BY fund_id, period
     HAVING COUNT(DISTINCT nav_per_share) = 1`,
    [fundId, period],
  );
  if (!row) return null;
  const n = Number(row.nav_per_share);
  return n > 0 ? n : null;
}

/**
 * Fill missing units from this period's opening NAV ÷ NAV/share.
 * Never pull lifetime portal capital — later months must not rewrite earlier NAV.
 */
export async function repairManualSeedUnits(fundId: string, period: string) {
  await query(
    `UPDATE investor_nav n
     SET
       units = ROUND(
         (n.opening_nav / NULLIF(COALESCE(n.nav_per_share, fpn.nav_per_share), 0))::numeric,
         4
       ),
       updated_at = NOW()
     FROM (SELECT $1::uuid AS fund_id, $2::varchar(7) AS period) p
     LEFT JOIN fund_period_nav fpn
       ON fpn.fund_id = p.fund_id AND fpn.period = p.period
     WHERE n.fund_id = p.fund_id
       AND n.period = p.period
       AND n.nav_source = 'manual'
       AND COALESCE(n.units, 0) = 0
       AND n.opening_nav > 0
       AND COALESCE(n.nav_per_share, fpn.nav_per_share) > 0`,
    [fundId, period],
  );
}

export async function repairCarriedForwardUnits(fundId: string, period: string) {
  const prev = previousPeriod(period);
  await query(
    `UPDATE investor_nav cur
     SET
       units = prev.units,
       capital = prev.capital,
       updated_at = NOW()
     FROM investor_nav prev
     WHERE cur.fund_id = prev.fund_id
       AND cur.investor_id = prev.investor_id
       AND cur.fund_id = $1
       AND cur.period = $2
       AND prev.period = $3
       AND COALESCE(cur.units, 0) = 0
       AND COALESCE(prev.units, 0) > 0`,
    [fundId, period, prev],
  );
}

export async function listPeriodNav(fundId: string, period: string) {
  return query<{
    investor_id: string;
    opening_nav: string | null;
    closing_nav: string | null;
    units: string;
    capital: string;
  }>(
    `SELECT investor_id::text, opening_nav::text, closing_nav::text,
            units::text, capital::text
     FROM investor_nav WHERE fund_id = $1 AND period = $2`,
    [fundId, period],
  );
}

export async function getPeriodEndNavMap(fundId: string, period: string) {
  const rows = await listPeriodNav(fundId, period);
  return new Map(
    rows.map((row) => {
      const end = periodEndNav(
        row.opening_nav != null ? Number(row.opening_nav) : null,
        row.closing_nav != null ? Number(row.closing_nav) : null,
      );
      return [row.investor_id, end ?? 0] as const;
    }),
  );
}

/** New period: prev closing → this opening & closing (profit applied later by allocation). */
export async function openPeriodRow(row: {
  investor_id: string;
  fundId: string;
  period: string;
  openingNav: number;
  units: string;
  capital: string;
}) {
  await query(
    `INSERT INTO investor_nav (investor_id, fund_id, period, opening_nav, closing_nav, nav_source, units, capital, updated_at)
     VALUES ($1, $2, $3, $4, $4, 'auto', $5, $6, NOW())
     ON CONFLICT (investor_id, fund_id, period) DO UPDATE SET
       opening_nav = EXCLUDED.opening_nav,
       closing_nav = EXCLUDED.closing_nav,
       units = CASE
         WHEN COALESCE(investor_nav.units, 0) = 0 THEN EXCLUDED.units
         ELSE investor_nav.units
       END,
       capital = EXCLUDED.capital,
       nav_source = 'auto',
       profit = NULL,
       updated_at = NOW()`,
    [
      row.investor_id,
      row.fundId,
      row.period,
      row.openingNav,
      row.units,
      row.capital,
    ],
  );
}

export async function applyAllocationToNav(
  client: PoolClient,
  params: {
    investorId: string;
    fundId: string;
    period: string;
    closingNav: number;
    profit: number;
    units: number;
  },
) {
  await client.query(
    `INSERT INTO investor_nav (investor_id, fund_id, period, opening_nav, closing_nav, profit, nav_source, units, capital, updated_at)
     VALUES ($1::uuid, $2::uuid, $3::varchar(7),
       COALESCE(
         (SELECT opening_nav FROM investor_nav WHERE investor_id = $1::uuid AND fund_id = $2::uuid AND period = $3::varchar(7)),
         $4
       ),
       $4, $5, 'auto',
       $6,
       ${portalCapitalSubquery("$1::uuid", "$2::uuid")},
       NOW())
     ON CONFLICT (investor_id, fund_id, period) DO UPDATE SET
       closing_nav = EXCLUDED.closing_nav,
       profit = EXCLUDED.profit,
       units = EXCLUDED.units,
       nav_source = 'auto',
       updated_at = NOW()`,
    [
      params.investorId,
      params.fundId,
      params.period,
      params.closingNav,
      params.profit,
      params.units,
    ],
  );
}

export async function upsertClosingNavAfterAllocation(
  client: PoolClient,
  investorId: string,
  fundId: string,
  period: string,
  closingNav: number,
  profit: number,
  units: number,
) {
  return applyAllocationToNav(client, {
    investorId,
    fundId,
    period,
    closingNav,
    profit,
    units,
  });
}
