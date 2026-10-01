import { formatPeriodLabel } from "./periods";

export type ReportingPeriodRow = {
  period_id: string;
  start_date: string;
  end_date: string;
  period_name: string;
  status: string;
};

/** Map reporting_period end_date (YYYY-MM-DD) → allocator period key YYYY-MM */
export function periodKeyFromEndDate(endDate: string): string {
  const ymd = String(endDate).trim().slice(0, 10);
  const m = ymd.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  return ymd.slice(0, 7);
}

export function isValuationComplete(status: string): boolean {
  return String(status).toLowerCase() === "completed";
}

export function periodDisplayLabel(
  rp: Pick<ReportingPeriodRow, "period_name" | "end_date">,
): string {
  if (rp.period_name?.trim()) return rp.period_name.trim();
  return formatPeriodLabel(periodKeyFromEndDate(rp.end_date));
}

/**
 * Pending P&L = reporting periods where valuation is incomplete,
 * or valuation is done but P&L not imported / not allocated yet.
 */
export function computePendingPlPeriods(
  reportingPeriods: ReportingPeriodRow[],
  fetchedPeriods: Set<string>,
  allocatedPeriods: Set<string>,
): { period: string; label: string }[] {
  const seen = new Set<string>();
  const pending: { period: string; label: string }[] = [];

  for (const rp of reportingPeriods) {
    const period = periodKeyFromEndDate(rp.end_date);
    if (seen.has(period)) continue;
    seen.add(period);

    const valued = isValuationComplete(rp.status);
    const fetched = fetchedPeriods.has(period);
    const allocated = allocatedPeriods.has(period);

    const isPending = !valued || !fetched || !allocated;
    if (isPending) {
      pending.push({ period, label: periodDisplayLabel(rp) });
    }
  }

  return pending;
}
