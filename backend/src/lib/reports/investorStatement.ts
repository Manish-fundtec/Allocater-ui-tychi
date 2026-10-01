import { parseShareClass } from "../allocation/investorClass";
import type { AllocationLineResult } from "../allocation/calculations";
import { round2 } from "./investorAllocationReport";
import type { PeriodFlow, PriorNavSnapshot } from "./investorAllocationReport";

export function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

function money(n: number): number {
  return round2(n);
}

function sharesFromAmount(amount: number, price: number | null): number {
  if (!price || price <= 0 || Math.abs(amount) < 0.005) return 0;
  return round4(amount / price);
}

function rateOfReturn(pnl: number, base: number): number | null {
  if (Math.abs(base) < 0.005) return null;
  return round2((pnl / base) * 100);
}

export type InvestorStatement = {
  investorId: string;
  investorName: string;
  investorCode: string;
  shareClass: string;
  account: {
    openingMtd: number;
    openingYtd: number;
    subscriptionMtd: number;
    subscriptionYtd: number;
    redemptionMtd: number;
    redemptionYtd: number;
    netPnlMtd: number;
    netPnlYtd: number;
    closing: number;
    rateOfReturnMtd: number | null;
    rateOfReturnYtd: number | null;
    absoluteReturnYtd: number | null;
  };
  shares: {
    opening: number;
    subscription: number;
    redemption: number;
    closing: number;
  };
  nav: {
    availableShares: number;
    navPerShare: number | null;
    totalNav: number;
  };
};

export function buildInvestorStatement(input: {
  line: AllocationLineResult;
  investorCode: string;
  investorName: string;
  priorMtd: PriorNavSnapshot | null;
  priorYtd: PriorNavSnapshot | null;
  mtdFlow: PeriodFlow;
  ytdFlow: PeriodFlow;
  issuePrice: number | null;
}): InvestorStatement {
  const { line, mtdFlow, ytdFlow, issuePrice } = input;
  const priorMtd =
    input.priorMtd && input.priorMtd.net > 0.005 ? input.priorMtd : null;
  const priorYtd =
    input.priorYtd && input.priorYtd.net > 0.005 ? input.priorYtd : null;

  const closing = money(line.closing_nav);
  const openingMtd = money(priorMtd?.net ?? 0);
  const openingYtd = money(priorYtd?.net ?? 0);
  const subscriptionMtd = money(mtdFlow.subscriptions);
  const subscriptionYtd = money(ytdFlow.subscriptions);
  const redemptionMtd = money(mtdFlow.redemptions);
  const redemptionYtd = money(ytdFlow.redemptions);

  const netPnlMtd = money(
    closing - openingMtd - subscriptionMtd + redemptionMtd,
  );
  const netPnlYtd = money(
    closing - openingYtd - subscriptionYtd + redemptionYtd,
  );

  const returnBaseMtd = openingMtd > 0.005 ? openingMtd : subscriptionMtd;
  const returnBaseYtd = openingYtd > 0.005 ? openingYtd : subscriptionYtd;

  const openingShares = round4(priorMtd?.units ?? 0);
  let subscriptionShares = sharesFromAmount(subscriptionMtd, issuePrice);
  const redemptionShares = sharesFromAmount(
    redemptionMtd,
    priorMtd?.navPerShare ?? issuePrice,
  );
  const closingShares = round4(line.units);
  if (
    subscriptionShares < 0.00005 &&
    openingShares < 0.00005 &&
    closingShares > 0
  ) {
    subscriptionShares = closingShares;
  }

  const navPerShare =
    closingShares > 0 ? money(closing / closingShares) : null;

  return {
    investorId: line.investor_id,
    investorName: input.investorName,
    investorCode: input.investorCode || "—",
    shareClass:
      parseShareClass(line.share_class) ??
      (line.share_class?.trim() ? line.share_class.trim() : "A"),
    account: {
      openingMtd,
      openingYtd,
      subscriptionMtd,
      subscriptionYtd,
      redemptionMtd,
      redemptionYtd,
      netPnlMtd,
      netPnlYtd,
      closing,
      rateOfReturnMtd: rateOfReturn(netPnlMtd, returnBaseMtd),
      rateOfReturnYtd: rateOfReturn(netPnlYtd, returnBaseYtd),
      absoluteReturnYtd: rateOfReturn(netPnlYtd, returnBaseYtd),
    },
    shares: {
      opening: openingShares,
      subscription: subscriptionShares,
      redemption: redemptionShares,
      closing: closingShares,
    },
    nav: {
      availableShares: closingShares,
      navPerShare,
      totalNav: closing,
    },
  };
}
