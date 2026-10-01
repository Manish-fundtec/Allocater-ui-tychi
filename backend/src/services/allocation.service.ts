import {
  calculateAllocationLines,
  summarizeLines,
  type FeeConfig,
  type InvestorInput,
} from "../lib/allocation/calculations";
import { ApiError } from "../lib/errors";
import { withTransaction } from "../db/transaction";
import * as plReportModel from "../models/plReport.model";
import * as feeConfigModel from "../models/feeConfig.model";
import * as allocationModel from "../models/allocation.model";
import * as investorNavModel from "../models/investorNav.model";
import * as unitsService from "./units.service";
import * as navPeriodService from "./navPeriod.service";
import type { AllocationLineResult } from "../lib/allocation/calculations";
import { getGlFundFeesForPeriod } from "../lib/pl/glFundFees";
import { adjustNetProfitForAllocation } from "../lib/pl/adjustNetProfit";
import { getPeriodBounds } from "../lib/pl/periodBounds";
import * as investorModel from "../models/investor.model";
import * as journalModel from "../models/journal.model";
import { previousPeriod } from "../lib/periods";
import { periodMonthRange } from "../lib/pl/periodRange";
import { roundNav } from "../lib/nav/periodNav";
import {
  adjustedOpeningCapital,
  isMgmtFeeEligible,
} from "../lib/allocation/investorClass";
import {
  inclusivePeriodDays,
  daysInCalendarMonth,
  mgmtAccrualDays,
  isDealingOnOrBeforePeriodEnd,
  isDealingInCalendarMonth,
} from "../lib/pl/periodDays";
import { roundUnits } from "../lib/units/calculations";
import { periodSubscriptionAmount } from "../lib/allocation/subscriptionAmount";
import * as capitalAdjustmentsModel from "../models/investorCapitalAdjustments.model";

const ZERO_FEE_CONFIG: FeeConfig = {
  mgmt_fee_pct: 0,
  perf_fee_pct: 0,
  hurdle_rate_pct: 0,
  frequency: "monthly",
};

/** Legacy UI: close_nav = period start, open_nav = period end */
export function mapAllocationLine(line: AllocationLineResult) {
  return {
    ...line,
    close_nav: line.opening_nav,
    open_nav: line.closing_nav,
  };
}

export type LivePriorClose = {
  units: number;
  net: number;
  adjHighWaterMark: number;
  accruedPerfFee: number;
};

type LoadAllocationOptions = {
  /** When false, skip live prior-period recalc (one-level lookback only). */
  resolveLivePrior?: boolean;
};

async function loadLivePriorClosing(
  fundId: string,
  priorPeriod: string,
  investorIds: string[],
): Promise<Map<string, LivePriorClose>> {
  const pl = await plReportModel.getByFundPeriod(fundId, priorPeriod);
  if (!pl) return new Map();
  try {
    const prior = await loadAllocationInputs(fundId, priorPeriod, investorIds, {
      resolveLivePrior: true,
    });
    return new Map(
      prior.lines.map((line) => [
        line.investor_id,
        {
          units: line.units,
          net: line.closing_nav,
          adjHighWaterMark: line.adj_high_water_mark,
          accruedPerfFee: line.perf_fee_accrued,
        },
      ]),
    );
  } catch {
    return new Map();
  }
}

export async function getLivePriorClosing(
  fundId: string,
  priorPeriod: string,
  investorIds: string[],
): Promise<Map<string, LivePriorClose>> {
  return loadLivePriorClosing(fundId, priorPeriod, investorIds);
}

export async function loadAllocationInputs(
  fundId: string,
  period: string,
  investorIds: string[],
  options?: LoadAllocationOptions,
) {
  await navPeriodService.ensurePeriodOpened(fundId, period);
  await investorNavModel.repairManualSeedUnits(fundId, period);

  const pl = await plReportModel.getByFundPeriod(fundId, period);
  if (!pl) throw new ApiError("P&L report not found for period", 400);

  const bounds = await getPeriodBounds(fundId, period);
  const feeRowForPeriod = await feeConfigModel.getFeeForPeriod(
    fundId,
    bounds.end,
  );
  const latestFeeRow =
    feeRowForPeriod ?? (await feeConfigModel.getFeeForAllocation(fundId));

  const feeConfig: FeeConfig = latestFeeRow
    ? {
        mgmt_fee_pct: Number(latestFeeRow.mgmt_fee_pct),
        perf_fee_pct: Number(latestFeeRow.perf_fee_pct),
        hurdle_rate_pct: Number(latestFeeRow.hurdle_rate_pct),
        frequency: latestFeeRow.frequency as FeeConfig["frequency"],
      }
    : ZERO_FEE_CONFIG;

  const firstDealingDates = await investorModel.getInvestorFirstDealingDates(
    fundId,
    investorIds,
  );
  const eligibleIds = investorIds.filter((id) =>
    isDealingOnOrBeforePeriodEnd(firstDealingDates.get(id), bounds.end),
  );
  if (eligibleIds.length === 0) {
    throw new ApiError(
      "No investors with a dealing date on or before this period",
      400,
    );
  }

  const investors = await allocationModel.loadInvestorsForAllocation(
    fundId,
    eligibleIds,
    period,
  );

  const enriched = await unitsService.enrichWithUnits(fundId, investors, period);

  const dealingDates = await investorModel.getInvestorDealingDatesInMonth(
    fundId,
    eligibleIds,
    period,
  );
  const fundPeriodDays = inclusivePeriodDays(bounds.start, bounds.end);
  const daysInMonth = daysInCalendarMonth(bounds.end);
  const priorPeriod = previousPeriod(period);
  const storedPriorEndNav = await investorNavModel.getPeriodEndNavMap(
    fundId,
    priorPeriod,
  );
  const storedPriorUnits = await investorNavModel.getUnitsMapForPeriod(
    fundId,
    priorPeriod,
  );
  const livePrior =
    options?.resolveLivePrior === false
      ? new Map<string, LivePriorClose>()
      : await loadLivePriorClosing(fundId, priorPeriod, eligibleIds);
  const calendarMonth = periodMonthRange(period);
  const periodFlows = await investorModel.getPeriodCapitalFlowsBatch(
    fundId,
    eligibleIds,
    calendarMonth.start,
    calendarMonth.end,
  );
  const shareClasses = await investorModel.getInvestorShareClassMap(
    fundId,
    eligibleIds,
    calendarMonth.start,
    calendarMonth.end,
  );
  const transactionCharges = await capitalAdjustmentsModel.getTransactionChargesMap(
    fundId,
    eligibleIds,
  );
  const inceptionPeriod = eligibleIds.every((id) =>
    isDealingInCalendarMonth(firstDealingDates.get(id), period),
  );
  let liveFundNavPerShare: number | null = null;
  if (livePrior.size > 0) {
    let liveNet = 0;
    let liveUnits = 0;
    for (const close of livePrior.values()) {
      liveNet += close.net;
      liveUnits += close.units;
    }
    if (liveUnits > 0) liveFundNavPerShare = liveNet / liveUnits;
  }
  const issueNav =
    (await investorNavModel.getManualNavPerShare(fundId, period)) ??
    (inceptionPeriod
      ? 2000
      : (liveFundNavPerShare ??
        (await investorNavModel.getFundClosingNavPerShare(
          fundId,
          priorPeriod,
        ))));

  const inputs: InvestorInput[] = enriched.map((inv) => {
    const dealingDate = dealingDates.get(inv.id) ?? null;
    const joinedThisPeriod = isDealingInCalendarMonth(
      firstDealingDates.get(inv.id),
      period,
    );
    const storedOpening = inv.opening_nav != null ? Number(inv.opening_nav) : 0;
    const priorClose = livePrior.get(inv.id);
    const priorEnd = priorClose?.net ?? storedPriorEndNav.get(inv.id) ?? 0;
    const openingNav = joinedThisPeriod
      ? storedOpening
      : priorEnd > 0
        ? priorEnd
        : storedOpening;
    const flows = periodFlows.get(inv.id) ?? {
      subscriptions: 0,
      redemptions: 0,
    };
    const shareClass = shareClasses.get(inv.id) ?? inv.share_class;
    const subAmt = periodSubscriptionAmount({
      subscriptions: flows.subscriptions,
      redemptions: flows.redemptions,
      transactionCharges: transactionCharges.get(inv.id) ?? 0,
      issuePrice: issueNav,
      shareClass,
      applyOnboardingCharges: inceptionPeriod && joinedThisPeriod,
    });
    const periodSub = subAmt.net;
    const periodRed = 0;
    const netFlow = subAmt.net;
    const hasFlow = Math.abs(netFlow) >= 0.005;
    const priorAdjHwm = priorClose?.adjHighWaterMark;
    const adjHighWaterMark = joinedThisPeriod
      ? netFlow
      : (priorAdjHwm ?? 0) + (hasFlow ? netFlow : 0);
    const priorUnits =
      priorClose?.units ?? storedPriorUnits.get(inv.id) ?? 0;
    const carriedUnits = priorUnits > 0 ? priorUnits : Number(inv.units) || 0;
    const newShares =
      !joinedThisPeriod && issueNav && issueNav > 0 && Math.abs(netFlow) >= 0.005
        ? roundUnits(netFlow / issueNav)
        : 0;
    const units = joinedThisPeriod
      ? issueNav && issueNav > 0 && periodSub > 0
        ? roundUnits(periodSub / issueNav)
        : carriedUnits
      : roundUnits(carriedUnits + newShares);
    return {
      id: inv.id,
      name: inv.name,
      units,
      gross_capital: subAmt.net || Number(inv.capital),
      net_capital: subAmt.net || Number(inv.capital),
      opening_nav: openingNav,
      allocation_capital: adjustedOpeningCapital({
        priorEndNav: joinedThisPeriod ? 0 : priorEnd,
        periodSubscriptions: periodSub,
        periodRedemptions: periodRed,
        openingNav,
      }),
      share_class: shareClass ?? null,
      dealing_date: dealingDate,
      mgmt_accrual_days: mgmtAccrualDays(bounds.start, bounds.end, dealingDate),
      first_subscription_date: firstDealingDates.get(inv.id) ?? null,
      adj_high_water_mark: adjHighWaterMark,
      opening_accrued_perf_fee: joinedThisPeriod
        ? 0
        : (priorClose?.accruedPerfFee ?? 0),
    };
  });

  const missingNav = inputs.filter((i) => !i.opening_nav);
  if (missingNav.length > 0) {
    throw new ApiError(
      `Missing opening NAV for: ${missingNav.map((i) => i.name).join(", ")}. Seed Jan NAV or carry forward from previous period.`,
      400,
    );
  }

  const plNetProfit = Number(pl.net_profit);
  const glFees = await getGlFundFeesForPeriod(fundId, bounds, period);
  const glFeesInPl = glFees.mgmtFee > 0 || glFees.perfFee > 0;
  const profitAdj = adjustNetProfitForAllocation(
    plNetProfit,
    glFees,
    feeRowForPeriod != null || (glFeesInPl && latestFeeRow != null),
  );
  const netProfit = profitAdj.netProfitForAllocation;
  const lines = calculateAllocationLines(netProfit, inputs, {
    feeConfig,
    applyInvestorFees: profitAdj.applyInvestorFees,
    periodDays: fundPeriodDays,
    daysInMonth,
    navDate: bounds.end,
  });

  return {
    plReportId: pl.id,
    netProfit,
    plNetProfit: profitAdj.plNetProfit,
    glMgmtFee: profitAdj.glMgmtFee,
    glPerfFee: profitAdj.glPerfFee,
    glFeesInPl: profitAdj.glFeesInPl,
    applyInvestorFees: profitAdj.applyInvestorFees,
    periodBounds: bounds,
    periodDays: fundPeriodDays,
    daysInMonth,
    feeConfig: feeRowForPeriod ?? latestFeeRow ?? null,
    feeConfigForCalc: feeConfig,
    lines,
    summary: summarizeLines(lines, netProfit),
    priorClosing: livePrior,
  };
}

export async function previewAllocation(
  fundId: string,
  period: string,
  investorIds: string[],
) {
  const result = await loadAllocationInputs(fundId, period, investorIds);
  return {
    period,
    netProfit: result.netProfit,
    plNetProfit: result.plNetProfit,
    glMgmtFee: result.glMgmtFee,
    glPerfFee: result.glPerfFee,
    glFeesInPl: result.glFeesInPl,
    applyInvestorFees: result.applyInvestorFees,
    feeConfig: result.feeConfig,
    summary: result.summary,
    lines: result.lines.map(mapAllocationLine),
  };
}

export async function runAllocation(
  fundId: string,
  period: string,
  investorIds: string[],
  runBy: string,
) {
  const result = await loadAllocationInputs(fundId, period, investorIds);
  const mgmtFeeAmount = roundNav(result.summary.totalMgmtFees);
  const perfFeeAmount = roundNav(result.summary.totalPerfFees);
  const fundProfit = roundNav(result.netProfit);
  const mgmtFeeAccounts =
    mgmtFeeAmount > 0
      ? await journalModel.resolveMgmtFeeAccounts(fundId)
      : null;
  const perfFeeAccounts =
    perfFeeAmount > 0
      ? await journalModel.resolvePerfFeeAccounts(fundId)
      : null;
  const retainedEarningCode =
    fundProfit !== 0
      ? await journalModel.resolveRetainedEarningAccount(fundId)
      : null;

  const persisted = await withTransaction((client) =>
    allocationModel.persistAllocationRun(client, {
      fundId,
      period,
      plReportId: result.plReportId,
      netProfit: result.netProfit,
      runBy,
      lines: result.lines,
      journalDate: result.periodBounds.end,
      mgmtFeeAmount,
      mgmtFeeAccounts,
      perfFeeAmount,
      perfFeeAccounts,
      retainedEarningCode,
    }),
  );

  return {
    runId: persisted.runId,
    journalId: persisted.journalId,
    perfJournalId: persisted.perfJournalId,
    pnlJournalId: persisted.pnlJournalId,
    period,
    summary: result.summary,
    lines: result.lines.map(mapAllocationLine),
  };
}

export function mapStoredAllocationLine(row: {
  investor_id: string;
  investor_name: string;
  units: string;
  share_pct: string;
  gross_profit: string;
  mgmt_fee: string;
  perf_fee: string;
  net_profit: string;
  opening_nav: string;
  closing_nav: string;
  capital: string | null;
  gross_capital: string | null;
  share_class: string | null;
}): AllocationLineResult {
  const units = Number(row.units);
  const netCapital = Number(row.capital ?? 0);
  const grossCapital = Number(row.gross_capital ?? row.capital ?? 0);
  const openingNav = Number(row.opening_nav);
  return {
    investor_id: row.investor_id,
    investor_name: row.investor_name,
    units,
    capital: netCapital,
    gross_capital: grossCapital,
    net_capital: netCapital,
    share_pct: Number(row.share_pct),
    gross_profit: Number(row.gross_profit),
    hurdle_return: 0,
    profit_above_hurdle: 0,
    mgmt_fee: Number(row.mgmt_fee),
    perf_fee: Number(row.perf_fee),
    net_profit: Number(row.net_profit),
    opening_nav: openingNav,
    closing_nav: Number(row.closing_nav),
    allocation_capital: openingNav,
    share_class: row.share_class,
    mgmt_fee_eligible: isMgmtFeeEligible(row.share_class),
    mgmt_accrual_days: 0,
    dealing_date: null,
    adj_high_water_mark: 0,
    perf_fee_accrued: 0,
  };
}

export async function getCompletedAllocationLines(
  fundId: string,
  period: string,
) {
  const run = await allocationModel.getLatestCompletedRun(fundId, period);
  if (!run) return null;
  const rows = await allocationModel.listCompletedRunLines(
    run.id,
    fundId,
    period,
  );
  return {
    runId: run.id,
    totalProfit: run.total_profit != null ? Number(run.total_profit) : null,
    lines: rows.map(mapStoredAllocationLine),
  };
}

export async function getAllocationHistory(fundId: string, limit: number) {
  const rows = await allocationModel.listHistory(fundId, limit);
  return rows.map((r) => ({
    period: r.period,
    totalProfit: r.total_profit != null ? Number(r.total_profit) : null,
    status: r.status,
    investorCount: Number(r.investor_count),
    runAt: r.run_at,
  }));
}

export async function getInvestorAllocationHistory(investorId: string) {
  const rows = await allocationModel.listInvestorHistory(investorId);
  return rows.map((r) => ({
    period: r.period,
    gross_profit: Number(r.gross_profit),
    mgmt_fee: Number(r.mgmt_fee),
    perf_fee: Number(r.perf_fee),
    net_profit: Number(r.net_profit),
    opening_nav: Number(r.opening_nav),
    closing_nav: Number(r.closing_nav),
    close_nav: Number(r.opening_nav),
    open_nav: Number(r.closing_nav),
  }));
}
