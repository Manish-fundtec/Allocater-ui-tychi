import { roundNav } from "../nav/periodNav";
import type { GlFundFees } from "./glFundFees";

export type NetProfitAdjustment = {
  plNetProfit: number;
  glMgmtFee: number;
  glPerfFee: number;
  /** GL booked fund-level mgmt/perf fees this period (already inside imported P&L net). */
  glFeesInPl: boolean;
  /** Apply investor-level mgmt/perf per allocator fee config. */
  applyInvestorFees: boolean;
  /** P&L net with GL mgmt/perf fees added back — base for capital % allocation. */
  netProfitForAllocation: number;
};

/**
 * Imported P&L net already includes GL mgmt/perf as expenses.
 * Add those fees back to get profit before investor fee accrual, then allocate by capital %.
 * Investor mgmt/perf is calculated separately (Class A mgmt on GAV, etc.).
 */
export function adjustNetProfitForAllocation(
  plNetProfit: number,
  glFees: GlFundFees,
  feeConfigEffective: boolean,
): NetProfitAdjustment {
  const glMgmtFee = glFees.mgmtFee;
  const glPerfFee = glFees.perfFee;
  const glFeesInPl = glMgmtFee > 0 || glPerfFee > 0;

  const netProfitForAllocation = roundNav(
    plNetProfit + glMgmtFee + glPerfFee,
  );

  return {
    plNetProfit,
    glMgmtFee,
    glPerfFee,
    glFeesInPl,
    applyInvestorFees: feeConfigEffective,
    netProfitForAllocation,
  };
}
