import { roundUnits, unitsFromCapital } from "./calculations";

/**
 * Excel rules:
 * - New investor:  Units = (Gross subscription − Transaction charges) ÷ NAV per unit
 * - Old investor:  Units = carried from investor_nav (do NOT recalc each period)
 */
export function resolveInvestorUnits(
  capital: number,
  navPerShare: number | null,
  storedUnits: number,
): number {
  if (storedUnits > 0) return roundUnits(storedUnits);
  if (navPerShare != null && navPerShare > 0 && capital > 0) {
    return roundUnits(unitsFromCapital(capital, navPerShare));
  }
  return 0;
}
