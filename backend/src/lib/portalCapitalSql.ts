/**
 * portal_capital_transactions date columns:
 * - date: trade / booking date
 * - dealing_date: NAV-effective date (use for mgmt fee accrual, mid-month joins)
 */
export const PORTAL_EFFECTIVE_DEALING_DATE = `COALESCE(pct.dealing_date, pct.date)`;
