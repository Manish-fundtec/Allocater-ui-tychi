function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * ACT/365 day count from original subscription date through NAV date.
 * Calendar difference (not inclusive of both endpoints):
 * 2025-03-03 → 2025-06-30 = 119 days.
 */
export function act365Days(startDate: string, endDate: string): number {
  const start = startDate.trim().slice(0, 10);
  const end = endDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return 0;
  }
  const s = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return 0;
  return Math.round((e - s) / 86_400_000);
}

/**
 * Hurdle Base ($) = Adj High Water Mark × (1 + hurdle_rate × Days / 365).
 * Annual hurdle, cumulative day-count from first subscription — not a monthly reset.
 */
export function hurdleBaseDollars(
  adjHighWaterMark: number,
  hurdleRatePct: number,
  days: number,
): number {
  const hwm = Number(adjHighWaterMark) || 0;
  if (hwm <= 0) return 0;
  const rate = (Number(hurdleRatePct) || 0) / 100;
  const nDays = Math.max(0, Number(days) || 0);
  return round2(hwm * (1 + (rate * nDays) / 365));
}

export type HwmPerformanceFeeInput = {
  gav: number;
  adjHighWaterMark: number;
  hurdleRatePct: number;
  /** Tier 1 rate (fee_config.perf_fee_pct), typically 20%. */
  perfFeePct: number;
  subscriptionDate: string | null | undefined;
  navDate: string;
  openingAccruedPerfFee: number;
};

export type HwmPerformanceFeeResult = {
  subscriptionDate: string | null;
  navDate: string;
  hurdleDays: number;
  hurdleBaseAmount: number;
  hurdleCrossed: "Yes" | "No";
  adjustedPnl: number | null;
  tier1: number | null;
  /** Unconfirmed — never applied until finance confirms the 30% breakpoint/rate. */
  tier2: number | null;
  perfFeesAccrued: number | null;
  perfFeesPnl: number | null;
  openingAccruedPerfFee: number | null;
};

function blankIfZero(value: number): number | null {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) return null;
  return round2(value);
}

/**
 * High-water-mark performance fee.
 *
 * Accrued is the cumulative fee vs HWM+hurdle (Tier 1 + Tier 2).
 * Performance Fees (P&L) is this month's change vs opening accrued.
 * Below hurdle: no fee this period (P&L blank); prior accrual is carried, not reversed.
 *
 * First-crossing month: Accrued is currently set to this month's Tier 1 (same as
 * Performance Fees (P&L)). The business reference shows Accrued/Accrual as 0 in
 * that first month and only carries the amount into next month's Opening Accrued.
 * Do not change that until finance confirms.
 *
 * Tier 2 (annualized return above 30%) is intentionally not applied — rate and
 * breakpoint are unconfirmed and never triggered in the May–July 2025 sample.
 */
export function calculateHwmPerformanceFee(
  input: HwmPerformanceFeeInput,
): HwmPerformanceFeeResult {
  const subscriptionDate = input.subscriptionDate?.trim().slice(0, 10) || null;
  const navDate = input.navDate.trim().slice(0, 10);
  const hurdleDays = subscriptionDate ? act365Days(subscriptionDate, navDate) : 0;
  const hurdleBaseAmount = hurdleBaseDollars(
    input.adjHighWaterMark,
    input.hurdleRatePct,
    hurdleDays,
  );
  const gav = round2(Number(input.gav) || 0);
  const openingRaw = round2(Number(input.openingAccruedPerfFee) || 0);
  const openingAccruedPerfFee = blankIfZero(openingRaw);
  const adjHwm = Number(input.adjHighWaterMark) || 0;
  const crossed = adjHwm > 0.00005 && gav > hurdleBaseAmount;

  if (!crossed) {
    return {
      subscriptionDate,
      navDate,
      hurdleDays,
      hurdleBaseAmount,
      hurdleCrossed: "No",
      adjustedPnl: null,
      tier1: null,
      tier2: null,
      perfFeesAccrued: openingAccruedPerfFee,
      perfFeesPnl: null,
      openingAccruedPerfFee,
    };
  }

  const adjustedPnl = round2(gav - hurdleBaseAmount);
  const tier1Rate = (Number(input.perfFeePct) || 0) / 100;
  const tier1 = round2(-(adjustedPnl * tier1Rate));
  const tier2: number | null = null;
  const accrued = round2(tier1 + (tier2 ?? 0));
  const pnl = round2(accrued - openingRaw);

  return {
    subscriptionDate,
    navDate,
    hurdleDays,
    hurdleBaseAmount,
    hurdleCrossed: "Yes",
    adjustedPnl,
    tier1,
    tier2,
    perfFeesAccrued: blankIfZero(accrued),
    perfFeesPnl: blankIfZero(pnl),
    openingAccruedPerfFee,
  };
}
