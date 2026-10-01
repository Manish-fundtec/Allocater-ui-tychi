import { ApiError } from "../lib/errors";
import { periodKeyFromEndDate } from "../lib/reportingPeriod";
import { loadPlSnapshotModule } from "../lib/tychi/reportRepoBridge";
import * as plReportModel from "../models/plReport.model";
import * as reportingPeriodModel from "../models/reportingPeriod.model";

export async function snapshotPlForPeriod(
  fundId: string,
  period: string,
  options?: { force?: boolean },
) {
  const rp = await reportingPeriodModel.getByFundPeriodKey(fundId, period);
  if (!rp) {
    throw new ApiError(`No reporting period found for ${period}`, 400);
  }
  if (String(rp.status).toLowerCase() !== "completed") {
    throw new ApiError(
      `Valuation not completed for ${period} (status: ${rp.status})`,
      400,
    );
  }

  if (!options?.force) {
    const existing = await plReportModel.exists(fundId, period);
    if (existing) {
      return { period, skipped: true as const };
    }
  }

  const mod = loadPlSnapshotModule();
  const result = await mod.upsertPlReportSnapshot({
    fund_id: fundId,
    end_date: rp.end_date,
    period_name: rp.period_name,
  });

  return { period: result.period, skipped: false as const, net_profit: result.net_profit };
}

export async function snapshotPlForEndDate(
  fundId: string,
  endDate: string,
  periodName?: string,
) {
  const mod = loadPlSnapshotModule();
  return mod.upsertPlReportSnapshot({
    fund_id: fundId,
    end_date: endDate,
    period_name: periodName,
  });
}

export function periodFromEndDate(endDate: string): string {
  return periodKeyFromEndDate(endDate);
}
