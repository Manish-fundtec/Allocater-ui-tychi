import { query } from "../db/pool";

export async function listByFund(fundId: string) {
  return query<{
    period_id: string;
    start_date: string;
    end_date: string;
    period_name: string;
    status: string;
  }>(
    `SELECT period_id::text, start_date, end_date, period_name, status
     FROM reporting_periods
     WHERE fund_id = $1
     ORDER BY end_date DESC`,
    [fundId],
  );
}

/** Match allocator period key YYYY-MM to reporting_periods.end_date */
export async function getByFundPeriodKey(fundId: string, period: string) {
  const rows = await query<{
    period_id: string;
    start_date: string;
    end_date: string;
    period_name: string;
    status: string;
  }>(
    `SELECT period_id::text, start_date, end_date, period_name, status
     FROM reporting_periods
     WHERE fund_id = $1
       AND LEFT(TRIM(end_date), 7) = $2
     ORDER BY end_date DESC
     LIMIT 1`,
    [fundId, period],
  );
  return rows[0] ?? null;
}
