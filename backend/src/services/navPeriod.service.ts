import { ApiError } from "../lib/errors";
import { periodEndNav, roundNav } from "../lib/nav/periodNav";
import { previousPeriod } from "../lib/periods";
import * as investorNavModel from "../models/investorNav.model";

/**
 * Open a period: copy previous month closing_nav → new month opening_nav & closing_nav.
 * Skips if rows already exist for the period.
 */
export async function ensurePeriodOpened(
  fundId: string,
  period: string,
): Promise<{ carried: boolean; count: number }> {
  const existing = await investorNavModel.countForFundPeriod(fundId, period);
  if (existing > 0) return { carried: false, count: 0 };

  const prev = previousPeriod(period);
  const prevRows = await investorNavModel.listPeriodNav(fundId, prev);
  if (prevRows.length === 0) {
    return { carried: false, count: 0 };
  }

  let count = 0;
  for (const row of prevRows) {
    const endNav = periodEndNav(
      row.opening_nav != null ? Number(row.opening_nav) : null,
      row.closing_nav != null ? Number(row.closing_nav) : null,
    );
    if (endNav == null) continue;

    const prevUnits =
      Number(row.units) > 0 ? String(row.units) : "0";

    await investorNavModel.openPeriodRow({
      investor_id: row.investor_id,
      fundId,
      period,
      openingNav: roundNav(endNav),
      units: prevUnits,
      capital: row.capital,
    });
    count++;
  }

  return { carried: true, count };
}

export async function carryForwardPeriod(fundId: string, period: string) {
  const existing = await investorNavModel.countForFundPeriod(fundId, period);
  if (existing > 0) {
    throw new ApiError("Period already has NAV data", 400);
  }

  const result = await ensurePeriodOpened(fundId, period);
  if (result.count === 0) {
    throw new ApiError("No NAV data for previous period", 400);
  }
  return { ok: true, count: result.count, auto: true };
}
