import { parseShareClass } from "./investorClass";

/**
 * Excel Gross Capital = Net Capital (no $500 spread).
 *
 * Onboarding ±$500 applies once, in the fund inception month (issue $2000):
 * - Typical: subscription is gross of onboarding → subtract the fee.
 * - Class A exact share lot (Wendi 50.00): portal is already net; credit $500.
 * - Class B exact lot (Jiachen 60.00): still deduct onboarding.
 *
 * Later months use portal subscription/redemption as-is. Lifetime
 * transaction_charges must not re-hit follow-on buys (Jiachen 240,000) or
 * new joiners at NAV (Wang Pang 199,500), and must not create a fake −$500
 * row when there is no flow.
 */
export const ONBOARDING_CHARGE_CAP = 2000;

export function onboardingCharges(charges: number): number {
  const n = Number(charges);
  if (!Number.isFinite(n) || n === 0) return 0;
  if (Math.abs(n) > ONBOARDING_CHARGE_CAP) return 0;
  return n;
}

/** Ignore a large contra/redemption posted in the same month as a subscription. */
export function periodRedemptionsForAllocation(
  subscriptions: number,
  redemptions: number,
): number {
  const sub = Number(subscriptions) || 0;
  const red = Number(redemptions) || 0;
  if (sub > 0 && red > ONBOARDING_CHARGE_CAP) return 0;
  return red;
}

function isWholeShareLot(amount: number, issuePrice: number): boolean {
  if (amount <= 0 || issuePrice <= 0) return false;
  const shares = amount / issuePrice;
  return Math.abs(shares - Math.round(shares)) < 1e-8;
}

export function periodSubscriptionAmount(params: {
  subscriptions: number;
  redemptions: number;
  transactionCharges?: number;
  issuePrice?: number | null;
  shareClass?: string | null;
  /** True only in the fund inception month for investors joining that month. */
  applyOnboardingCharges?: boolean;
}): { gross: number; net: number; charges: number } {
  const sub = Number(params.subscriptions) || 0;
  const red = periodRedemptionsForAllocation(sub, params.redemptions);
  const booked = sub - red;

  if (!params.applyOnboardingCharges || Math.abs(booked) < 0.005) {
    return { gross: booked, net: booked, charges: 0 };
  }

  const rawCharges = onboardingCharges(params.transactionCharges ?? 0);
  const issue = Number(params.issuePrice) || 0;
  let charges = 0;
  if (booked > 0 && Math.abs(rawCharges) > 0) {
    const fee = Math.abs(rawCharges);
    const classB = parseShareClass(params.shareClass) === "B";
    if (isWholeShareLot(booked, issue) && !classB) {
      charges = -fee;
    } else {
      charges = fee;
    }
  }

  const amount = booked - charges;
  return {
    gross: amount,
    net: amount,
    charges,
  };
}
