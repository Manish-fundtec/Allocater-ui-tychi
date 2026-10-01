import { query, queryOne } from "../../db/pool";
import { roundNav } from "../nav/periodNav";
import type { PeriodBounds } from "./periodBounds";
import { parseFundFeesFromPlRaw } from "./plFundFees";

export type GlFundFees = {
  mgmtFee: number;
  perfFee: number;
  total: number;
};

const EMPTY_FEES: GlFundFees = { mgmtFee: 0, perfFee: 0, total: 0 };

function classifyFeeAccountCode(accountCode: string): "mgmt" | "perf" | null {
  const code = accountCode.trim();
  if (code === "51000") return "mgmt";
  if (code === "52000") return "perf";
  return null;
}

type PlRawMeta = {
  raw: unknown;
  mStart: string;
};

async function getPlRawMeta(
  fundId: string,
  period: string,
  bounds: PeriodBounds,
): Promise<PlRawMeta | null> {
  const row = await queryOne<{ raw_json: unknown }>(
    `SELECT raw_json FROM pl_reports WHERE fund_id = $1::uuid AND period = $2`,
    [fundId, period],
  );
  if (!row?.raw_json) return null;

  const root = row.raw_json as Record<string, unknown>;
  const range =
    root.range && typeof root.range === "object"
      ? (root.range as Record<string, unknown>)
      : null;
  const mStart = String(range?.m_start ?? bounds.start).trim().slice(0, 10);

  return { raw: row.raw_json, mStart };
}

/**
 * P&L MTD for expense accounts — matches Tychi GL report (Dr: debit − credit).
 */
async function getFundFeesFromPnLMtd(
  fundId: string,
  mStart: string,
  end: string,
): Promise<GlFundFees> {
  const rows = await query<{
    account_code: string;
    mtd_dr: string;
    mtd_cr: string;
  }>(
    `SELECT TRIM(jl.account_code) AS account_code,
            COALESCE(SUM(CASE
              WHEN j.journal_date >= $2::date AND j.journal_date <= $3::date
              THEN jl.debit_amount_base ELSE 0 END), 0)::text AS mtd_dr,
            COALESCE(SUM(CASE
              WHEN j.journal_date >= $2::date AND j.journal_date <= $3::date
              THEN jl.credit_amount_base ELSE 0 END), 0)::text AS mtd_cr
     FROM journals j
     JOIN journal_lines jl ON jl.journal_id = j.journal_id
     WHERE j.fund_id = $1::uuid
       AND TRIM(jl.account_code) IN ('51000', '52000')
     GROUP BY TRIM(jl.account_code)`,
    [fundId, mStart, end],
  );

  let mgmtFee = 0;
  let perfFee = 0;

  for (const row of rows) {
    const kind = classifyFeeAccountCode(row.account_code);
    if (!kind) continue;
    const amount = roundNav(
      Math.abs(Number(row.mtd_dr) - Number(row.mtd_cr)),
    );
    if (kind === "mgmt") mgmtFee += amount;
    else perfFee += amount;
  }

  return {
    mgmtFee: roundNav(mgmtFee),
    perfFee: roundNav(perfFee),
    total: roundNav(mgmtFee + perfFee),
  };
}

/**
 * Fund-level mgmt/perf fees for the reporting period.
 * 1. Imported P&L snapshot rows (MTD per GL line — same as Tychi GL)
 * 2. P&L MTD from journals (debit − credit for month)
 */
export async function getGlFundFeesForPeriod(
  fundId: string,
  bounds: PeriodBounds,
  period?: string,
): Promise<GlFundFees> {
  if (period) {
    const meta = await getPlRawMeta(fundId, period, bounds);
    if (meta) {
      const fromPl = parseFundFeesFromPlRaw(meta.raw);
      if (fromPl) return fromPl;

      const fromMtd = await getFundFeesFromPnLMtd(
        fundId,
        meta.mStart,
        bounds.end,
      );
      if (fromMtd.total > 0) return fromMtd;
    }
  }

  const fromMtd = await getFundFeesFromPnLMtd(
    fundId,
    bounds.start,
    bounds.end,
  );
  if (fromMtd.total > 0) return fromMtd;

  return EMPTY_FEES;
}
