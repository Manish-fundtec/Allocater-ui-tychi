import { queryOne } from "../db/pool";

export async function getInitialNav(fundId: string): Promise<number | null> {
  const row = await queryOne<{ initial_nav: string }>(
    `SELECT initial_nav::text FROM fund_nav_config WHERE fund_id = $1`,
    [fundId],
  );
  if (!row) return null;
  const n = Number(row.initial_nav);
  return n > 0 ? n : null;
}

export async function upsertInitialNav(
  fundId: string,
  initialNav: number,
): Promise<{ fund_id: string; initial_nav: number }> {
  const row = await queryOne<{ fund_id: string; initial_nav: string }>(
    `INSERT INTO fund_nav_config (fund_id, initial_nav, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (fund_id) DO UPDATE SET
       initial_nav = EXCLUDED.initial_nav,
       updated_at = NOW()
     RETURNING fund_id::text, initial_nav::text`,
    [fundId, initialNav],
  );
  return {
    fund_id: row!.fund_id,
    initial_nav: Number(row!.initial_nav),
  };
}

export async function getConfig(fundId: string) {
  return { fund_id: fundId, initial_nav: await getInitialNav(fundId) };
}
