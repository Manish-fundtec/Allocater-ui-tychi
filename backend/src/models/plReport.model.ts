import { query, queryOne } from "../db/pool";
import { resolveNetProfit } from "../lib/pl/netProfit";

export async function countDistinctPeriods(fundId: string) {
  return queryOne<{ count: string }>(
    `SELECT COUNT(DISTINCT period)::text AS count FROM pl_reports WHERE fund_id = $1`,
    [fundId],
  );
}

export async function getLastPl(fundId: string) {
  return queryOne<{
    period: string;
    net_profit: string;
    gross_revenue: string;
    total_expenses: string;
  }>(
    `SELECT period, net_profit::text, gross_revenue::text, total_expenses::text
     FROM pl_reports
     WHERE fund_id = $1 ORDER BY period DESC LIMIT 1`,
    [fundId],
  );
}

export async function listPeriods(fundId: string) {
  return query<{ period: string }>(
    `SELECT period FROM pl_reports WHERE fund_id = $1`,
    [fundId],
  );
}

export async function listByFund(fundId: string) {
  return query<{
    id: string;
    period: string;
    net_profit: string;
    gross_revenue: string;
    total_expenses: string;
    fetched_at: string | null;
  }>(
    `SELECT id::text, period, net_profit::text, gross_revenue::text,
            total_expenses::text, fetched_at::text
     FROM pl_reports WHERE fund_id = $1`,
    [fundId],
  );
}

export async function getRawJson(fundId: string, period: string) {
  const row = await queryOne<{ raw_json: unknown }>(
    `SELECT raw_json FROM pl_reports WHERE fund_id = $1 AND period = $2`,
    [fundId, period],
  );
  return row?.raw_json ?? null;
}

export async function getByFundPeriod(fundId: string, period: string) {
  const row = await queryOne<{
    id: string;
    net_profit: string;
    gross_revenue: string;
    total_expenses: string;
  }>(
    `SELECT id::text, net_profit::text, gross_revenue::text, total_expenses::text
     FROM pl_reports WHERE fund_id = $1 AND period = $2`,
    [fundId, period],
  );
  if (!row) return null;
  return {
    id: row.id,
    net_profit: String(resolveNetProfit(row)),
  };
}

export async function exists(fundId: string, period: string) {
  return queryOne(`SELECT id FROM pl_reports WHERE fund_id = $1 AND period = $2`, [
    fundId,
    period,
  ]);
}

export async function upsertPlReport(params: {
  fundId: string;
  period: string;
  netProfit: number;
  grossRevenue: number;
  totalExpenses: number;
  rawJson: string;
}) {
  await query(
    `INSERT INTO pl_reports (fund_id, period, net_profit, gross_revenue, total_expenses, fetched_at, raw_json)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6::jsonb)
     ON CONFLICT (fund_id, period) DO UPDATE SET
       net_profit = EXCLUDED.net_profit,
       gross_revenue = EXCLUDED.gross_revenue,
       total_expenses = EXCLUDED.total_expenses,
       fetched_at = NOW(),
       raw_json = EXCLUDED.raw_json`,
    [
      params.fundId,
      params.period,
      params.netProfit,
      params.grossRevenue,
      params.totalExpenses,
      params.rawJson,
    ],
  );
}

export async function importHistory(fundId: string, limit = 20) {
  const rows = await query<{
    period: string;
    net_profit: string;
    gross_revenue: string;
    total_expenses: string;
    fetched_at: string;
  }>(
    `SELECT period, net_profit::text, gross_revenue::text, total_expenses::text,
            fetched_at::text
     FROM pl_reports WHERE fund_id = $1
     ORDER BY fetched_at DESC LIMIT $2`,
    [fundId, limit],
  );
  return rows.map((r) => ({
    period: r.period,
    net_profit: String(resolveNetProfit(r)),
    fetched_at: r.fetched_at,
  }));
}
