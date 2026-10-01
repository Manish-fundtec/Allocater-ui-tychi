/**
 * Period NAV rules:
 *   closing_nav = opening_nav + net_profit (per investor, after allocation)
 *   next period opening_nav = previous period closing_nav (carry-forward)
 */

export function closingNavFromOpening(
  openingNav: number,
  netProfit: number,
): number {
  return openingNav + netProfit;
}

/** Previous period end NAV to use as next period opening (prefer closing, else opening). */
export function periodEndNav(
  openingNav: number | null,
  closingNav: number | null,
): number | null {
  if (closingNav != null && closingNav > 0) return closingNav;
  if (openingNav != null && openingNav > 0) return openingNav;
  return null;
}

export function roundNav(n: number): number {
  return Math.round(n * 10000) / 10000;
}
