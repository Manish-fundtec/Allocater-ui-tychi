import type { AllocationLineResult, FeeConfig } from "./calculations";
import { capitalForAllocationPool } from "./investorClass";
import { roundNav } from "../nav/periodNav";

export type CalcStep = {
  label: string;
  formula: string;
  value: number;
  /** How to render value in UI */
  format?: "currency" | "percent" | "units" | "nav" | "yesno";
};

export type InvestorCapitalContext = {
  grossCapital: number;
  transactionCharges: number;
  subscriptionDuringMonth: number;
  redemptionDuringMonth: number;
};

export type ProfitAllocationContext = {
  plNetProfit: number;
  glMgmtFee: number;
  glPerfFee: number;
  glFeesInPl: boolean;
  applyInvestorFees: boolean;
  netProfitForAllocation: number;
  periodStart?: string;
  periodEnd?: string;
  periodDays?: number;
  daysInMonth?: number;
};

export type InvestorAllocationBreakdown = {
  investorId: string;
  investorName: string;
  fund: {
    totalUnits: number;
    totalCapital: number;
    netProfitBeforeFees: number;
    plNetProfit?: number;
    glMgmtFee?: number;
    glPerfFee?: number;
    glFeesInPl?: boolean;
  };
  investor: {
    units: number;
    sharePct: number;
    netCapital: number;
    grossCapital: number;
    transactionCharges: number;
    openingNavTotal: number;
    openingNavPerShare: number | null;
    subscriptionDuringMonth: number;
    redemptionDuringMonth: number;
  };
  profitAllocation: {
    steps: CalcStep[];
    investorProfitShare: number;
  };
  managementFee: {
    steps: CalcStep[];
    fee: number;
    profitAfterMgmtFee: number;
    gav: number;
    gavAfterMgmtFee: number;
  };
  performanceFee: {
    steps: CalcStep[];
    hurdleRatePct: number;
    hurdleValue: number;
    highWatermarkPerShare: number | null;
    crossedHighWatermark: boolean;
    eligible: "Y" | "N";
    fee: number;
  };
  summary: {
    netProfit: number;
    closingNavTotal: number;
    closingNavPerShare: number | null;
  };
};

function navPerShare(total: number, units: number): number | null {
  if (units <= 0) return null;
  return roundNav(total / units);
}

/** Format amounts the same way formulas reference them (4 dp, no currency symbol). */
function amt(n: number): string {
  return roundNav(n).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

export function buildInvestorBreakdown(params: {
  line: AllocationLineResult;
  netProfit: number;
  totalCapital: number;
  totalFundUnits: number;
  feeConfig: FeeConfig;
  capitalContext?: InvestorCapitalContext;
  profitContext?: ProfitAllocationContext;
}): InvestorAllocationBreakdown {
  const { line, netProfit, totalCapital, totalFundUnits, feeConfig } = params;
  const profitCtx = params.profitContext;
  const ctx = params.capitalContext ?? {
    grossCapital: line.capital,
    transactionCharges: 0,
    subscriptionDuringMonth: 0,
    redemptionDuringMonth: 0,
  };

  const sharePct = line.share_pct;
  const applyInvestorFees = profitCtx?.applyInvestorFees ?? true;
  const periodLabel =
    profitCtx?.periodStart && profitCtx?.periodEnd
      ? `${profitCtx.periodStart} to ${profitCtx.periodEnd}`
      : "reporting period";
  const periodDays = profitCtx?.periodDays ?? 30;
  const daysInMonth = profitCtx?.daysInMonth ?? 30;

  const openingNavTotal =
    line.allocation_capital > 0 ? line.allocation_capital : line.opening_nav;
  const openingNavPerShare = navPerShare(openingNavTotal, line.units);
  const highWatermarkPerShare = openingNavPerShare;
  const crossedHighWatermark =
    line.profit_above_hurdle > 0 || line.perf_fee > 0;

  const gav = roundNav(openingNavTotal + line.gross_profit);
  const profitAfterMgmtFee = roundNav(line.gross_profit - line.mgmt_fee);
  const gavAfterMgmtFee = roundNav(gav - line.mgmt_fee);
  const closingNavPerShare = navPerShare(line.closing_nav, line.units);

  const profitSteps: CalcStep[] = [
    {
      label: "Total units in fund",
      formula: "Σ investor units for period",
      value: totalFundUnits,
      format: "units",
    },
    {
      label: "Units held by investor",
      formula: "From NAV / capital records",
      value: line.units,
      format: "units",
    },
    {
      label: "Capital share",
      formula: `${amt(openingNavTotal)} adjusted opening NAV ÷ ${amt(totalCapital)} fund adjusted opening → ${sharePct.toFixed(2)}%`,
      value: sharePct,
      format: "percent",
    },
  ];

  if (profitCtx?.glFeesInPl) {
    profitSteps.push(
      {
        label: "P&L net profit (imported)",
        formula: "From Tychi GL (includes mgmt/perf in expenses)",
        value: profitCtx.plNetProfit,
        format: "currency",
      },
      {
        label: "GL management fee (fund)",
        formula: "From P&L report — removed before capital % allocation",
        value: profitCtx.glMgmtFee,
        format: "currency",
      },
      {
        label: "GL performance fee (fund)",
        formula: "From P&L report — removed before capital % allocation",
        value: profitCtx.glPerfFee,
        format: "currency",
      },
      {
        label: "Fund profit for allocation",
        formula: `${amt(profitCtx.plNetProfit)} + ${amt(profitCtx.glMgmtFee)} + ${amt(profitCtx.glPerfFee)}`,
        value: profitCtx.netProfitForAllocation,
        format: "currency",
      },
    );
  } else if (!applyInvestorFees) {
    profitSteps.push(
      {
        label: "P&L net profit (imported)",
        formula: "From Tychi GL",
        value: profitCtx?.plNetProfit ?? netProfit,
        format: "currency",
      },
      {
        label: "Fund profit for allocation",
        formula: "No allocator fee config effective for this period",
        value: netProfit,
        format: "currency",
      },
    );
  } else {
    profitSteps.push({
      label: "Fund profit (before mgmt & perf fees)",
      formula: "P&L net profit for period",
      value: netProfit,
      format: "currency",
    });
  }

  profitSteps.push({
    label: applyInvestorFees ? "Gross profit (P&L share)" : "Net profit / loss",
    formula: `${amt(netProfit)} × ${sharePct.toFixed(2)}%`,
    value: line.gross_profit,
    format: "currency",
  });

  const mgmtSteps: CalcStep[] = [
    {
      label: "Opening NAV (investor)",
      formula: "Period-start account value",
      value: openingNavTotal,
      format: "currency",
    },
    {
      label: "Subscription during period",
      formula: `Σ subscriptions (${periodLabel})`,
      value: ctx.subscriptionDuringMonth,
      format: "currency",
    },
    {
      label: "Redemption during period",
      formula: `Σ redemptions (${periodLabel})`,
      value: ctx.redemptionDuringMonth,
      format: "currency",
    },
    {
      label: "Profit allocation (gross)",
      formula: "Investor share of fund profit",
      value: line.gross_profit,
      format: "currency",
    },
    {
      label: "GAV (gross asset value)",
      formula: `Opening NAV + Profit allocation = ${amt(openingNavTotal)} + ${amt(line.gross_profit)}`,
      value: gav,
      format: "currency",
    },
    {
      label: "Management fee",
      formula: !applyInvestorFees
        ? "No fee config effective for this period"
        : !line.mgmt_fee_eligible
          ? "Class B — no management fee"
          : line.dealing_date
            ? `(GAV × ${feeConfig.mgmt_fee_pct}% / 12) × (${line.mgmt_accrual_days} days from dealing ${line.dealing_date} / ${daysInMonth} days in month)`
            : `(GAV × ${feeConfig.mgmt_fee_pct}% / 12) × (${line.mgmt_accrual_days} days / ${daysInMonth} days in month)`,
      value: line.mgmt_fee,
      format: "currency",
    },
    {
      label: "Profit after management fee",
      formula: `${amt(line.gross_profit)} − ${amt(line.mgmt_fee)}`,
      value: profitAfterMgmtFee,
      format: "currency",
    },
    {
      label: "GAV after management fee",
      formula: `${amt(gav)} − ${amt(line.mgmt_fee)}`,
      value: gavAfterMgmtFee,
      format: "currency",
    },
  ];

  const perfSteps: CalcStep[] = [
    {
      label: "Adj High Water Mark",
      formula: "Prior HWM + this month Amount (not current NAV)",
      value: line.adj_high_water_mark,
      format: "currency",
    },
    {
      label: "Hurdle Base ($)",
      formula: `Adj HWM × (1 + ${feeConfig.hurdle_rate_pct}% × ACT/365 days from first subscription / 365)`,
      value: line.hurdle_return,
      format: "currency",
    },
    {
      label: "GAV after management fee",
      formula: `${amt(gav)} − ${amt(line.mgmt_fee)}`,
      value: gavAfterMgmtFee,
      format: "currency",
    },
    {
      label: "Hurdle Base (up 5%)",
      formula: crossedHighWatermark
        ? "GAV > Hurdle Base ($) → Yes"
        : "GAV ≤ Hurdle Base ($) → No",
      value: crossedHighWatermark ? 1 : 0,
      format: "yesno",
    },
    {
      label: "Adjusted P&L",
      formula: crossedHighWatermark
        ? `${amt(gavAfterMgmtFee)} − ${amt(line.hurdle_return)}`
        : "Blank (hurdle not crossed)",
      value: line.profit_above_hurdle,
      format: "currency",
    },
    {
      label: "Performance Fees (P&L)",
      formula: applyInvestorFees
        ? crossedHighWatermark
          ? `Accrued (Tier 1 ${feeConfig.perf_fee_pct}% of Adjusted P&L) − opening accrued`
          : "Not accrued (GAV ≤ Hurdle Base)"
        : profitCtx?.glFeesInPl
          ? "Included in GL fund P&L — not charged again"
          : "No fee config effective for this period",
      value: applyInvestorFees ? -Math.abs(line.perf_fee) : line.perf_fee,
      format: "currency",
    },
  ];

  return {
    investorId: line.investor_id,
    investorName: line.investor_name,
    fund: {
      totalUnits: totalFundUnits,
      totalCapital: roundNav(totalCapital),
      netProfitBeforeFees: netProfit,
      plNetProfit: profitCtx?.plNetProfit,
      glMgmtFee: profitCtx?.glMgmtFee,
      glPerfFee: profitCtx?.glPerfFee,
      glFeesInPl: profitCtx?.glFeesInPl,
    },
    investor: {
      units: line.units,
      sharePct,
      netCapital: line.net_capital,
      grossCapital: ctx.grossCapital || line.gross_capital,
      transactionCharges: ctx.transactionCharges,
      openingNavTotal,
      openingNavPerShare,
      subscriptionDuringMonth: ctx.subscriptionDuringMonth,
      redemptionDuringMonth: ctx.redemptionDuringMonth,
    },
    profitAllocation: {
      steps: profitSteps,
      investorProfitShare: line.gross_profit,
    },
    managementFee: {
      steps: mgmtSteps,
      fee: line.mgmt_fee,
      profitAfterMgmtFee,
      gav,
      gavAfterMgmtFee,
    },
    performanceFee: {
      steps: perfSteps,
      hurdleRatePct: feeConfig.hurdle_rate_pct,
      hurdleValue: line.hurdle_return,
      highWatermarkPerShare,
      crossedHighWatermark,
      eligible: crossedHighWatermark ? "Y" : "N",
      fee: line.perf_fee,
    },
    summary: {
      netProfit: line.net_profit,
      closingNavTotal: line.closing_nav,
      closingNavPerShare,
    },
  };
}

export function buildAllBreakdowns(
  lines: AllocationLineResult[],
  netProfit: number,
  feeConfig: FeeConfig,
  capitalByInvestor: Map<string, InvestorCapitalContext>,
  profitContext?: ProfitAllocationContext,
): InvestorAllocationBreakdown[] {
  const totalCapital = lines.reduce(
    (sum, l) =>
      sum +
      capitalForAllocationPool({
        allocation_capital: l.allocation_capital,
        opening_nav: l.opening_nav,
        gross_capital: l.gross_capital,
        net_capital: l.net_capital,
        share_class: l.share_class,
      }),
    0,
  );
  const totalFundUnits = lines.reduce((sum, l) => sum + l.units, 0);

  return lines.map((line) =>
    buildInvestorBreakdown({
      line,
      netProfit,
      totalCapital,
      totalFundUnits,
      feeConfig,
      capitalContext: capitalByInvestor.get(line.investor_id),
      profitContext,
    }),
  );
}
