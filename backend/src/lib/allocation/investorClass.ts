import { roundNav } from "../nav/periodNav";

/** Parse share class from portal `class_description` (e.g. "A", "Class A", "B"). */
export function parseShareClass(
  classDescription: string | null | undefined,
): "A" | "B" | null {
  if (!classDescription?.trim()) return null;
  const d = classDescription.trim().toUpperCase();
  if (d.includes("CLASS B") || d === "B") return "B";
  if (d.includes("CLASS A") || d === "A") return "A";
  return null;
}

/** Management fee applies to Class A only; unknown class defaults to A. */
export function isMgmtFeeEligible(
  classDescription: string | null | undefined,
): boolean {
  return parseShareClass(classDescription) !== "B";
}

/**
 * Excel Adjusted Opening Net Capital Balance:
 * previous period end NAV + subscriptions − redemptions in this period
 * (dealing date). Falls back to this period's opening NAV when that is 0
 * (e.g. seeded new investor with no prior row).
 */
export function adjustedOpeningCapital(params: {
  priorEndNav: number;
  periodSubscriptions: number;
  periodRedemptions: number;
  openingNav: number;
}): number {
  const prior = Math.max(0, Number(params.priorEndNav) || 0);
  const flow =
    (Number(params.periodSubscriptions) || 0) -
    (Number(params.periodRedemptions) || 0);
  const adj = roundNav(prior + flow);
  if (adj > 0) return adj;
  return roundNav(Number(params.openingNav) || 0);
}

/**
 * Excel allocation % uses Adjusted Opening Net Capital Balance,
 * not subscription gross/net. Same for Class A and Class B.
 */
export function capitalForAllocationPool(inv: {
  allocation_capital?: number;
  opening_nav?: number;
  gross_capital?: number;
  net_capital?: number;
  share_class?: string | null;
}): number {
  const alloc = Number(inv.allocation_capital);
  if (Number.isFinite(alloc) && alloc !== 0) return alloc;
  const opening = Number(inv.opening_nav);
  if (Number.isFinite(opening) && opening !== 0) return opening;
  return Number(inv.net_capital) || 0;
}

export function totalCapitalForAllocationPool(
  investors: Array<{
    allocation_capital?: number;
    opening_nav?: number;
    gross_capital?: number;
    net_capital?: number;
    share_class?: string | null;
  }>,
): number {
  return investors.reduce((sum, inv) => sum + capitalForAllocationPool(inv), 0);
}
