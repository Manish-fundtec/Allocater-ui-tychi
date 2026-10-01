import { queryOne } from "../db/pool";

export async function getNavPerShare(fundId: string, period: string) {
  const row = await queryOne<{ nav_per_share: string }>(
    `SELECT nav_per_share::text FROM fund_period_nav
     WHERE fund_id = $1 AND period = $2`,
    [fundId, period],
  );
  if (!row) return null;
  const n = Number(row.nav_per_share);
  return n > 0 ? n : null;
}

export async function upsertPeriodNav(
  fundId: string,
  period: string,
  navPerShare: number,
) {
  await queryOne(
    `INSERT INTO fund_period_nav (fund_id, period, nav_per_share, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (fund_id, period) DO UPDATE SET
       nav_per_share = EXCLUDED.nav_per_share,
       updated_at = NOW()`,
    [fundId, period, navPerShare],
  );
}
