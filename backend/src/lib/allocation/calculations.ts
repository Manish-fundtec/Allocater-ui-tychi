import { closingNavFromOpening, roundNav } from "../nav/periodNav";
import {
  isMgmtFeeEligible,
  totalCapitalForAllocationPool,
} from "./investorClass";
import { calculateHwmPerformanceFee } from "./performanceFee";

export type FeeConfig = {
  mgmt_fee_pct: number;
  perf_fee_pct: number;
  hurdle_rate_pct: number;
  frequency: "monthly" | "quarterly" | "yearly";
};

export type InvestorInput = {
  id: string;
  name: string;
  units: number;
  /** Gross subscription capital (before transaction charges). */
  gross_capital: number;
  /** Net capital after transaction charges. */
  net_capital: number;
  opening_nav: number;
  /** Excel Adjusted Opening net capital — used for allocation %. */
  allocation_capital?: number;
  share_class: string | null;
  /** Dealing date from portal_capital_transactions (mgmt fee accrual start). */
  dealing_date: string | null;
  mgmt_accrual_days: number;
  /** Original first subscription date (ACT/365 hurdle day-count start). */
  first_subscription_date: string | null;
  adj_high_water_mark: number;
  opening_accrued_perf_fee: number;
};

export type AllocationLineResult = {
  investor_id: string;
  investor_name: string;
  units: number;
  /** Net subscription capital (after transaction charges). */
  capital: number;
  gross_capital: number;
  net_capital: number;
  share_pct: number;
  gross_profit: number;
  hurdle_return: number;
  profit_above_hurdle: number;
  mgmt_fee: number;
  perf_fee: number;
  net_profit: number;
  opening_nav: number;
  closing_nav: number;
  /** Excel Adjusted Opening net capital (share % / GAV / new open NAV base). */
  allocation_capital: number;
  share_class: string | null;
  mgmt_fee_eligible: boolean;
  mgmt_accrual_days: number;
  dealing_date: string | null;
  adj_high_water_mark: number;
  perf_fee_accrued: number;
};

export function frequencyFactor(frequency: FeeConfig["frequency"]): number {
  switch (frequency) {
    case "monthly":
      return 1 / 12;
    case "quarterly":
      return 1 / 4;
    case "yearly":
      return 1;
    default:
      return 1 / 12;
  }
}

export type AllocationCalculationOptions = {
  feeConfig: FeeConfig;
  applyInvestorFees: boolean;
  /** Inclusive days in reporting period (for mgmt fee accrual). */
  periodDays: number;
  /** Calendar days in the period-end month (e.g. 28 for February). */
  daysInMonth: number;
  /** Period-end NAV date (YYYY-MM-DD) for HWM hurdle day-count. */
  navDate: string;
};

/**
 * Excel: (GAV × annual% / 12) × (period days / days in month)
 * e.g. (124,481 × 0.25% / 12) × (12 / 28)
 */
function mgmtFeeOnGav(
  gav: number,
  mgmtRatePct: number,
  periodDays: number,
  daysInMonth: number,
): number {
  if (gav <= 0 || mgmtRatePct <= 0 || periodDays <= 0 || daysInMonth <= 0) {
    return 0;
  }
  const monthlyRate = mgmtRatePct / 100 / 12;
  return gav * monthlyRate * (periodDays / daysInMonth);
}

export function calculateAllocationLines(
  netProfit: number,
  investors: InvestorInput[],
  options: AllocationCalculationOptions,
): AllocationLineResult[] {
  const { feeConfig, applyInvestorFees, daysInMonth, navDate } = options;
  const totalPoolCapital = totalCapitalForAllocationPool(investors);

  return investors.map((inv) => {
    const units = Number(inv.units);
    const grossCapital = Number(inv.gross_capital);
    const netCapital = Number(inv.net_capital);
    const openingNav = Number(inv.opening_nav);
    const allocBase = Number(
      inv.allocation_capital != null && inv.allocation_capital !== 0
        ? inv.allocation_capital
        : openingNav,
    );
    // Excel Adjusted Opening: Net Capital Balance ÷ fund total
    const sharePct =
      totalPoolCapital > 0 ? allocBase / totalPoolCapital : 0;
    const grossProfit = netProfit * sharePct;
    const gavBeforeMgmt = allocBase + grossProfit;
    const mgmtEligible = isMgmtFeeEligible(inv.share_class);

    const mgmtFee =
      applyInvestorFees && mgmtEligible
        ? mgmtFeeOnGav(
            gavBeforeMgmt,
            Number(feeConfig.mgmt_fee_pct),
            inv.mgmt_accrual_days,
            daysInMonth,
          )
        : 0;
    const gavAfterMgmt = gavBeforeMgmt - mgmtFee;
    const perf = applyInvestorFees
      ? calculateHwmPerformanceFee({
          gav: gavAfterMgmt,
          adjHighWaterMark: Number(inv.adj_high_water_mark) || 0,
          hurdleRatePct: Number(feeConfig.hurdle_rate_pct),
          perfFeePct: Number(feeConfig.perf_fee_pct),
          subscriptionDate: inv.first_subscription_date,
          navDate,
          openingAccruedPerfFee: Number(inv.opening_accrued_perf_fee) || 0,
        })
      : null;
    const perfPnl = perf?.perfFeesPnl ?? 0;
    const perfFee = perfPnl < -0.00005 ? -perfPnl : 0;
    const hurdleReturn = perf?.hurdleBaseAmount ?? 0;
    const profitAboveHurdle = perf?.adjustedPnl ?? 0;
    const netProfitLine = grossProfit - mgmtFee + perfPnl;
    const closingNav = closingNavFromOpening(allocBase, netProfitLine);

    return {
      investor_id: inv.id,
      investor_name: inv.name,
      units,
      capital: roundNav(netCapital),
      gross_capital: roundNav(grossCapital),
      net_capital: roundNav(netCapital),
      share_pct: sharePct * 100,
      gross_profit: roundNav(grossProfit),
      hurdle_return: roundNav(hurdleReturn),
      profit_above_hurdle: roundNav(profitAboveHurdle),
      mgmt_fee: roundNav(mgmtFee),
      perf_fee: roundNav(perfFee),
      net_profit: roundNav(netProfitLine),
      opening_nav: roundNav(openingNav),
      closing_nav: roundNav(closingNav),
      allocation_capital: roundNav(allocBase),
      share_class: inv.share_class,
      mgmt_fee_eligible: mgmtEligible,
      mgmt_accrual_days: inv.mgmt_accrual_days,
      dealing_date: inv.dealing_date,
      adj_high_water_mark: roundNav(Number(inv.adj_high_water_mark) || 0),
      perf_fee_accrued: roundNav(perf?.perfFeesAccrued ?? 0),
    };
  });
}

export function summarizeLines(
  lines: AllocationLineResult[],
  fundProfitForAllocation?: number,
) {
  const summed = lines.reduce(
    (acc, line) => ({
      totalProfit: acc.totalProfit + line.gross_profit,
      totalMgmtFees: acc.totalMgmtFees + line.mgmt_fee,
      totalPerfFees: acc.totalPerfFees + line.perf_fee,
      totalNetProfit: acc.totalNetProfit + line.net_profit,
    }),
    { totalProfit: 0, totalMgmtFees: 0, totalPerfFees: 0, totalNetProfit: 0 },
  );
  return {
    ...summed,
    totalProfit:
      fundProfitForAllocation != null
        ? roundNav(fundProfitForAllocation)
        : summed.totalProfit,
  };
}
