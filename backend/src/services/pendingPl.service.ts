import {
  computePendingPlPeriods,
  isValuationComplete,
  periodDisplayLabel,
  periodKeyFromEndDate,
  type ReportingPeriodRow,
} from "../lib/reportingPeriod";
import * as reportingPeriodModel from "../models/reportingPeriod.model";
import * as plReportModel from "../models/plReport.model";
import * as allocationModel from "../models/allocation.model";

export async function loadPendingPlContext(fundId: string) {
  const [reportingPeriods, fetchedPeriods, allocatedPeriods] = await Promise.all([
    reportingPeriodModel.listByFund(fundId),
    plReportModel.listPeriods(fundId),
    allocationModel.listPeriods(fundId),
  ]);

  const fetchedSet = new Set(fetchedPeriods.map((r) => r.period));
  const allocatedSet = new Set(allocatedPeriods.map((r) => r.period));

  const pending = computePendingPlPeriods(
    reportingPeriods,
    fetchedSet,
    allocatedSet,
  );

  return {
    reportingPeriods,
    fetchedSet,
    allocatedSet,
    pendingPeriods: pending.map((p) => p.period),
    pendingLabels: pending.map((p) => p.label),
  };
}

export function allocationStatusForPeriod(
  rp: ReportingPeriodRow,
  fetchedSet: Set<string>,
  allocatedSet: Set<string>,
): "allocated" | "pending" | "not_fetched" {
  const period = periodKeyFromEndDate(rp.end_date);
  if (!isValuationComplete(rp.status)) return "not_fetched";
  if (!fetchedSet.has(period)) return "not_fetched";
  return allocatedSet.has(period) ? "allocated" : "pending";
}

export { periodDisplayLabel, periodKeyFromEndDate };
