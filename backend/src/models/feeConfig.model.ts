import { query, queryOne } from "../db/pool";

export async function getCurrent(fundId: string) {
  return queryOne<{
    mgmt_fee_pct: string;
    perf_fee_pct: string;
    hurdle_rate_pct: string;
    frequency: string;
    effective_from: string;
  }>(
    `SELECT mgmt_fee_pct::text, perf_fee_pct::text, hurdle_rate_pct::text, frequency, effective_from::text
     FROM fee_config WHERE fund_id = $1 ORDER BY effective_from DESC LIMIT 1`,
    [fundId],
  );
}

export async function getHistory(fundId: string) {
  return query<{
    mgmt_fee_pct: string;
    perf_fee_pct: string;
    hurdle_rate_pct: string;
    frequency: string;
    effective_from: string;
  }>(
    `SELECT mgmt_fee_pct::text, perf_fee_pct::text, hurdle_rate_pct::text, frequency, effective_from::text
     FROM fee_config WHERE fund_id = $1 ORDER BY effective_from DESC`,
    [fundId],
  );
}

export async function insertFeeConfig(params: {
  fundId: string;
  mgmtFeePct: number;
  perfFeePct: number;
  hurdleRate: number;
  frequency: string;
  effectiveFrom: string;
}) {
  await query(
    `INSERT INTO fee_config (fund_id, mgmt_fee_pct, perf_fee_pct, hurdle_rate_pct, frequency, effective_from)
     VALUES ($1, $2, $3, $4, $5, $6::date)
     ON CONFLICT (fund_id, effective_from) DO UPDATE SET
       mgmt_fee_pct = EXCLUDED.mgmt_fee_pct,
       perf_fee_pct = EXCLUDED.perf_fee_pct,
       hurdle_rate_pct = EXCLUDED.hurdle_rate_pct,
       frequency = EXCLUDED.frequency`,
    [
      params.fundId,
      params.mgmtFeePct,
      params.perfFeePct,
      params.hurdleRate,
      params.frequency,
      params.effectiveFrom,
    ],
  );
}

export async function getFeeForPeriod(fundId: string, periodEndDate: string) {
  return queryOne<{
    mgmt_fee_pct: string;
    perf_fee_pct: string;
    hurdle_rate_pct: string;
    frequency: string;
    effective_from: string;
  }>(
    `SELECT mgmt_fee_pct::text, perf_fee_pct::text, hurdle_rate_pct::text,
            frequency, effective_from::text
     FROM fee_config
     WHERE fund_id = $1
       AND effective_from <= $2::date
     ORDER BY effective_from DESC
     LIMIT 1`,
    [fundId, periodEndDate],
  );
}

export async function getFeeForAllocation(fundId: string) {
  return queryOne<{
    mgmt_fee_pct: string;
    perf_fee_pct: string;
    hurdle_rate_pct: string;
    frequency: string;
  }>(
    `SELECT mgmt_fee_pct, perf_fee_pct, hurdle_rate_pct, frequency
     FROM fee_config WHERE fund_id = $1
     ORDER BY effective_from DESC LIMIT 1`,
    [fundId],
  );
}
