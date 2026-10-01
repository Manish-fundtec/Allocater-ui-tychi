import * as reportingPeriodModel from "../../models/reportingPeriod.model";
import { queryOne } from "../../db/pool";
import { periodMonthRange } from "./periodRange";
import { PORTAL_EFFECTIVE_DEALING_DATE } from "../portalCapitalSql";

export type PeriodBounds = {
  start: string;
  end: string;
  source: "reporting_period" | "fund_inception" | "calendar_month";
};

async function getFundFirstDealingDateInMonth(
  fundId: string,
  period: string,
): Promise<string | null> {
  const cal = periodMonthRange(period);
  const row = await queryOne<{ dealing_date: string }>(
    `SELECT MIN(${PORTAL_EFFECTIVE_DEALING_DATE})::text AS dealing_date
     FROM portal_capital_transactions pct
     WHERE pct.fund_id = $1::uuid
       AND ${PORTAL_EFFECTIVE_DEALING_DATE} >= $2::date
       AND ${PORTAL_EFFECTIVE_DEALING_DATE} <= $3::date
       AND pct.subscription_amount > 0`,
    [fundId, cal.start, cal.end],
  );
  return row?.dealing_date?.trim().slice(0, 10) ?? null;
}

/**
 * Reporting period bounds. Start is never before the fund's first dealing date
 * in the month (e.g. 17 Feb, not 1 Feb).
 */
export async function getPeriodBounds(
  fundId: string,
  period: string,
): Promise<PeriodBounds> {
  const cal = periodMonthRange(period);
  const firstDealing = await getFundFirstDealingDateInMonth(fundId, period);

  const rp = await reportingPeriodModel.getByFundPeriodKey(fundId, period);
  let start = rp?.start_date
    ? String(rp.start_date).trim().slice(0, 10)
    : cal.start;
  let end = rp?.end_date
    ? String(rp.end_date).trim().slice(0, 10)
    : cal.end;
  let source: PeriodBounds["source"] = rp
    ? "reporting_period"
    : firstDealing && firstDealing > cal.start
      ? "fund_inception"
      : "calendar_month";

  if (!rp && firstDealing && firstDealing > cal.start) {
    start = firstDealing;
  } else if (firstDealing && firstDealing > start && firstDealing <= end) {
    start = firstDealing;
  }

  return { start, end, source };
}
