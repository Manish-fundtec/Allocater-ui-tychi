import { isMgmtFeeEligible } from "./investorClass";
import type { FeeConfig } from "./calculations";
import type { InvestorAllocationBreakdown, CalcStep } from "./breakdown";
import type { InvestorAllocationRow } from "../reports/investorAllocationReport";
import { round2 } from "../reports/investorAllocationReport";

function n(value: number | null | undefined): number {
  return Number(value) || 0;
}

function amt(value: number): string {
  return round2(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export type FeeReviewLineFromReport = {
  investor_id: string;
  investor_name: string;
  investor_code: string;
  units: number;
  capital: number;
  gross_capital: number;
  net_capital: number;
  transaction_charges: number;
  share_pct: number;
  gross_profit: number;
  hurdle_return: number;
  profit_above_hurdle: number;
  mgmt_fee: number;
  perf_fee: number;
  net_profit: number;
  opening_nav: number;
  closing_nav: number;
  close_nav: number;
  open_nav: number;
  nav_per_share: number | null;
  allocation_capital: number;
  share_class: string | null;
  mgmt_fee_eligible: boolean;
};

function mgmtFormula(opts: {
  eligible: boolean;
  firstMonth: boolean;
  inceptionPeriod: boolean;
  mgmtPct: number;
}): string {
  if (!opts.eligible) return "Class B — no management fee";
  if (opts.firstMonth && !opts.inceptionPeriod) {
    return `-(NAV_Prior × ${opts.mgmtPct}% / 12)  [first month — full month, no day proration]`;
  }
  if (opts.inceptionPeriod && opts.firstMonth) {
    return `-(NAV_Prior × ${opts.mgmtPct}% / 12) × (accrual days / days in month)`;
  }
  return `-(NAV_Prior × ${opts.mgmtPct}% / 12)`;
}

export function buildBreakdownFromAllocationReport(params: {
  row: InvestorAllocationRow;
  totals: InvestorAllocationRow;
  feeConfig: FeeConfig;
  inceptionPeriod: boolean;
}): InvestorAllocationBreakdown {
  const { row, totals, feeConfig, inceptionPeriod } = params;
  const adjNet = n(row.adjNet);
  const grossMtd = n(row.grossMtdPnl);
  const navPrior = n(row.navPrior);
  const mtdMgmt = n(row.mtdMgmtFees);
  const netMtd = n(row.netMtdPnl);
  const gav = n(row.gav);
  const units = n(row.closingShares ?? row.adjShares);
  const sharePct = (Number(row.allocationPct) || 0) * 100;
  const subRed = n(row.subRedAmount);
  const firstMonth = row.openingMtdNet == null;
  const eligible = isMgmtFeeEligible(row.termsTitle);
  const fundGross = n(totals.grossMtdPnl);
  const fundUnits = n(totals.closingShares ?? totals.adjShares);
  const fundAdj = n(totals.adjNet);

  const profitSteps: CalcStep[] = [
    {
      label: "Total units in fund",
      formula: "Σ closing shares (Investor Allocation report)",
      value: fundUnits,
      format: "units",
    },
    {
      label: "Units held by investor",
      formula: "Adjusted Opening / Closing shares",
      value: units,
      format: "units",
    },
    {
      label: "Allocation %",
      formula: `${amt(adjNet)} adj. opening ÷ ${amt(fundAdj)} fund adj. opening`,
      value: sharePct,
      format: "percent",
    },
    {
      label: "Fund Gross MTD P&L",
      formula: "allocation_runs.total_profit",
      value: fundGross,
      format: "currency",
    },
    {
      label: "Gross MTD P&L",
      formula: `${amt(fundGross)} × ${(sharePct / 100).toFixed(8)}`,
      value: grossMtd,
      format: "currency",
    },
  ];

  const mgmtSteps: CalcStep[] = [
    {
      label: "Adjusted Opening (Net Capital)",
      formula: "Opening MTD + Subscription/Redemption Amount",
      value: adjNet,
      format: "currency",
    },
    {
      label: "Subscription/Redemption Amount",
      formula: "Period dealing amount",
      value: subRed,
      format: "currency",
    },
    {
      label: "Gross MTD P&L",
      formula: "Investor share of fund Gross MTD",
      value: grossMtd,
      format: "currency",
    },
    {
      label: "NAV_Prior Mgmt Fees",
      formula: `${amt(adjNet)} + ${amt(grossMtd)}`,
      value: navPrior,
      format: "currency",
    },
    {
      label: "MTD Mgmt Fees",
      formula: mgmtFormula({
        eligible,
        firstMonth,
        inceptionPeriod,
        mgmtPct: feeConfig.mgmt_fee_pct,
      }),
      value: mtdMgmt,
      format: "currency",
    },
    {
      label: "Net MTD P&L",
      formula: `${amt(grossMtd)} + ${amt(mtdMgmt)}`,
      value: netMtd,
      format: "currency",
    },
    {
      label: "GAV",
      formula: `${amt(navPrior)} + ${amt(mtdMgmt)}`,
      value: gav,
      format: "currency",
    },
  ];

  const hurdle = n(row.hurdleBase);
  const perf = n(row.perfFeesPnl);
  const priorHwm = n(row.priorHighWaterMark);
  const adjHwm = n(row.adjHighWaterMark);
  const crossed = row.hurdleCrossed === "Yes";
  const days = row.hurdleDays ?? 0;
  const hurdleRate = feeConfig.hurdle_rate_pct;
  const perfRate = feeConfig.perf_fee_pct;

  const perfSteps: CalcStep[] = [
    {
      label: "Prior High Water Mark",
      formula: "Previous month Adj High Water Mark (0 if new investor)",
      value: priorHwm,
      format: "currency",
    },
    {
      label: "Adj High Water Mark",
      formula: "Prior HWM + this month Amount",
      value: adjHwm,
      format: "currency",
    },
    {
      label: "Number of Days (ACT/365)",
      formula: "NAV Date − original subscription date",
      value: days,
      format: "units",
    },
    {
      label: "Hurdle Base ($)",
      formula: `Adj HWM × (1 + ${hurdleRate}% × ${days} / 365)`,
      value: hurdle,
      format: "currency",
    },
    {
      label: "GAV",
      formula: "NAV_Prior + MTD Mgmt Fees",
      value: gav,
      format: "currency",
    },
    {
      label: "Hurdle Base (up 5%)",
      formula: crossed ? "GAV > Hurdle Base ($) → Yes" : "GAV ≤ Hurdle Base ($) → No",
      value: crossed ? 1 : 0,
      format: "yesno",
    },
    {
      label: "Adjusted P&L",
      formula: crossed ? "GAV − Hurdle Base ($)" : "Blank (hurdle not crossed)",
      value: n(row.adjustedPnl),
      format: "currency",
    },
    {
      label: "Tier 1 (20%)",
      formula: crossed
        ? `-(Adjusted P&L × ${perfRate}%)`
        : "Blank (hurdle not crossed)",
      value: n(row.tier1),
      format: "currency",
    },
    {
      label: "Opening Accrued Performance Fee",
      formula: "Prior month Accrued Performance Fees",
      value: n(row.openingAccruedPerfFee),
      format: "currency",
    },
    {
      label: "Accrued Performance Fees",
      formula: crossed
        ? "Tier 1 + Tier 2 (cumulative)"
        : "Carried opening accrued (no reversal)",
      value: n(row.perfFeesAccrued),
      format: "currency",
    },
    {
      label: "Performance Fees (P&L)",
      formula: crossed
        ? "Accrued (current) − Opening Accrued"
        : "Not accrued (GAV ≤ Hurdle Base)",
      value: perf,
      format: "currency",
    },
  ];

  return {
    investorId: row.investorId,
    investorName: row.investorName,
    fund: {
      totalUnits: fundUnits,
      totalCapital: fundAdj,
      netProfitBeforeFees: fundGross,
    },
    investor: {
      units,
      sharePct,
      netCapital: adjNet,
      grossCapital: n(row.adjGross ?? row.adjNet),
      transactionCharges: 0,
      openingNavTotal: adjNet,
      openingNavPerShare: row.adjNavPerShare,
      subscriptionDuringMonth: subRed > 0 ? subRed : 0,
      redemptionDuringMonth: subRed < 0 ? Math.abs(subRed) : 0,
    },
    profitAllocation: {
      steps: profitSteps,
      investorProfitShare: grossMtd,
    },
    managementFee: {
      steps: mgmtSteps,
      fee: mtdMgmt,
      profitAfterMgmtFee: netMtd,
      gav: navPrior,
      gavAfterMgmtFee: gav,
    },
    performanceFee: {
      steps: perfSteps,
      hurdleRatePct: feeConfig.hurdle_rate_pct,
      hurdleValue: hurdle,
      highWatermarkPerShare: row.adjNavPerShare,
      crossedHighWatermark: crossed,
      eligible: crossed ? "Y" : "N",
      fee: perf,
    },
    summary: {
      netProfit: netMtd,
      closingNavTotal: n(row.closingNet),
      closingNavPerShare: row.closingNavPerShare,
    },
  };
}

export function lineFromAllocationReport(
  row: InvestorAllocationRow,
): FeeReviewLineFromReport {
  const adjNet = n(row.adjNet);
  const closing = n(row.closingNet);
  const units = n(row.closingShares ?? row.adjShares);
  return {
    investor_id: row.investorId,
    investor_name: row.investorName,
    investor_code: row.investorCode,
    units,
    capital: adjNet,
    gross_capital: n(row.adjGross ?? row.adjNet),
    net_capital: adjNet,
    transaction_charges: 0,
    share_pct: (Number(row.allocationPct) || 0) * 100,
    gross_profit: n(row.grossMtdPnl),
    hurdle_return: n(row.hurdleBase),
    profit_above_hurdle: n(row.adjustedPnl),
    mgmt_fee: n(row.mtdMgmtFees),
    perf_fee: n(row.perfFeesPnl),
    net_profit: n(row.netMtdPnl),
    opening_nav: adjNet,
    closing_nav: closing,
    close_nav: adjNet,
    open_nav: closing,
    nav_per_share: row.closingNavPerShare,
    allocation_capital: adjNet,
    share_class: row.termsTitle || null,
    mgmt_fee_eligible: isMgmtFeeEligible(row.termsTitle),
  };
}
