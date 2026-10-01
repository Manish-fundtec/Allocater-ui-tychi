/**
 * Fund NAV per share from investor_nav totals:
 * Total Fund Value ÷ Total Units
 */
export function fundNavPerShareFromTotals(
  totalFundValue: number,
  totalUnits: number,
): number | null {
  if (totalUnits > 0 && totalFundValue > 0) {
    return totalFundValue / totalUnits;
  }
  return null;
}

/** Units = Capital ÷ NAV per share */
export function unitsFromCapital(
  capital: number,
  navPerShare: number,
): number {
  if (capital <= 0 || navPerShare <= 0) return 0;
  return capital / navPerShare;
}

export function roundUnits(n: number): number {
  return Math.round(n * 10000) / 10000;
}
