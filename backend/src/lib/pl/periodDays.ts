/** Inclusive calendar days between period bounds (YYYY-MM-DD). */
export function inclusivePeriodDays(start: string, end: string): number {
  const s = new Date(`${start.trim().slice(0, 10)}T00:00:00Z`);
  const e = new Date(`${end.trim().slice(0, 10)}T00:00:00Z`);
  const ms = e.getTime() - s.getTime();
  if (Number.isNaN(ms) || ms < 0) return 30;
  return Math.round(ms / 86_400_000) + 1;
}

/** Calendar days in the month of a date (e.g. Feb 2025 → 28). */
export function daysInCalendarMonth(dateStr: string): number {
  const iso = dateStr.trim().slice(0, 10);
  const [year, month] = iso.split("-").map(Number);
  if (!year || !month) return 30;
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Investor is in the period only if their first dealing date is on or before
 * the period end (not yet dealt / later joiners are excluded).
 */
export function isDealingOnOrBeforePeriodEnd(
  firstDealingDate: string | null | undefined,
  periodEnd: string,
): boolean {
  const dealing = firstDealingDate?.trim().slice(0, 10);
  if (!dealing) return false;
  return dealing <= periodEnd.trim().slice(0, 10);
}

/** True when the dealing date falls in allocator period YYYY-MM. */
export function isDealingInCalendarMonth(
  dealingDate: string | null | undefined,
  period: string,
): boolean {
  const dealing = dealingDate?.trim().slice(0, 10);
  if (!dealing || !/^\d{4}-\d{2}$/.test(period)) return false;
  return dealing.startsWith(`${period}-`);
}

/**
 * Mgmt fee accrual days: from dealing date (or period start) through period end.
 */
export function mgmtAccrualDays(
  periodStart: string,
  periodEnd: string,
  dealingDate: string | null | undefined,
): number {
  let accrualStart = periodStart.trim().slice(0, 10);
  const dealing = dealingDate?.trim().slice(0, 10);
  if (dealing && dealing > accrualStart) {
    accrualStart = dealing;
  }
  return inclusivePeriodDays(accrualStart, periodEnd);
}
