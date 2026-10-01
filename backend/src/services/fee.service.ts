import { frequencyFactor } from "../lib/allocation/calculations";
import {
  buildAllBreakdowns,
  type InvestorCapitalContext,
} from "../lib/allocation/breakdown";
import {
  buildBreakdownFromAllocationReport,
  lineFromAllocationReport,
} from "../lib/allocation/reportFeeReview";
import { ApiError } from "../lib/errors";
import * as allocationService from "./allocation.service";
import * as feeConfigModel from "../models/feeConfig.model";
import * as investorModel from "../models/investor.model";
import * as investorService from "./investor.service";
import * as investorAllocationReportService from "./investorAllocationReport.service";
import { inclusivePeriodDays, daysInCalendarMonth } from "../lib/pl/periodDays";
import { periodMonthRange } from "../lib/pl/periodRange";

function mapFee(row: {
  mgmt_fee_pct: string;
  perf_fee_pct: string;
  hurdle_rate_pct: string;
  frequency: string;
  effective_from?: string;
}) {
  return {
    mgmtFeePct: Number(row.mgmt_fee_pct),
    perfFeePct: Number(row.perf_fee_pct),
    hurdleRate: Number(row.hurdle_rate_pct),
    frequency: row.frequency,
    effectiveFrom: row.effective_from ?? null,
  };
}

export async function getFees(fundId: string) {
  const current = await feeConfigModel.getCurrent(fundId);
  const history = await feeConfigModel.getHistory(fundId);
  return {
    current: current ? mapFee(current) : null,
    history: history.map(mapFee),
  };
}

export async function createFee(params: {
  fundId: string;
  mgmtFeePct: number;
  perfFeePct: number;
  hurdleRate: number;
  frequency: string;
  effectiveFrom: string;
}) {
  await feeConfigModel.insertFeeConfig(params);
  const current = await feeConfigModel.getCurrent(params.fundId);
  return { current: current ? mapFee(current) : null };
}

export async function reviewFees(
  fundId: string,
  period: string,
  investorIds?: string[],
) {
  const report =
    await investorAllocationReportService.getInvestorAllocationReport(
      fundId,
      period,
    );
  if (report.allocated && report.rows.length > 0) {
    return reviewFeesFromAllocationReport(fundId, period, report, investorIds);
  }
  return reviewFeesFromAllocationEngine(fundId, period, investorIds);
}

async function reviewFeesFromAllocationReport(
  fundId: string,
  period: string,
  report: Awaited<
    ReturnType<typeof investorAllocationReportService.getInvestorAllocationReport>
  >,
  investorIds?: string[],
) {
  if (!("allocated" in report) || !report.allocated) {
    throw new ApiError("Allocation report is not available", 400);
  }
  const boundsStart = report.asOfDate;
  const feeRow =
    (await feeConfigModel.getFeeForPeriod(fundId, boundsStart)) ??
    (await feeConfigModel.getFeeForAllocation(fundId));
  const feeConfig = feeRow ? mapFee(feeRow) : null;
  const feeConfigForCalc = feeRow
    ? {
        mgmt_fee_pct: Number(feeRow.mgmt_fee_pct),
        perf_fee_pct: Number(feeRow.perf_fee_pct),
        hurdle_rate_pct: Number(feeRow.hurdle_rate_pct),
        frequency: feeRow.frequency as "monthly" | "quarterly" | "yearly",
      }
    : {
        mgmt_fee_pct: 0,
        perf_fee_pct: 0,
        hurdle_rate_pct: 0,
        frequency: "monthly" as const,
      };
  const inceptionPeriod = report.rows.every((row) => row.openingMtdNet == null);
  const filterSet =
    investorIds && investorIds.length > 0 ? new Set(investorIds) : null;
  const rows = filterSet
    ? report.rows.filter((row) => filterSet.has(row.investorId))
    : report.rows;
  const lines = rows.map(lineFromAllocationReport);
  const breakdowns = Object.fromEntries(
    rows.map((row) => [
      row.investorId,
      buildBreakdownFromAllocationReport({
        row,
        totals: report.totals,
        feeConfig: feeConfigForCalc,
        inceptionPeriod,
      }),
    ]),
  );
  return {
    period,
    allocated: true,
    source: "investor_allocation_report",
    netProfit: Number(report.totals.grossMtdPnl) || 0,
    plNetProfit: Number(report.totals.grossMtdPnl) || 0,
    glMgmtFee: 0,
    glPerfFee: 0,
    glFeesInPl: false,
    applyInvestorFees: feeRow != null,
    feeConfig,
    frequencyFactor: frequencyFactor(feeConfigForCalc.frequency),
    summary: {
      totalProfit: Number(report.totals.grossMtdPnl) || 0,
      totalMgmtFees: Number(report.totals.mtdMgmtFees) || 0,
      totalPerfFees: Number(report.totals.perfFeesPnl) || 0,
      totalNetProfit: Number(report.totals.netMtdPnl) || 0,
    },
    lines,
    breakdowns,
  };
}

async function reviewFeesFromAllocationEngine(
  fundId: string,
  period: string,
  investorIds?: string[],
) {
  const allInvestors = await investorService.listInvestors(
    fundId,
    "active",
    "",
  );
  const allIds = allInvestors.map((i) => i.id);
  if (allIds.length === 0) {
    throw new ApiError("No active investors for fund", 400);
  }

  const result = await allocationService.loadAllocationInputs(
    fundId,
    period,
    allIds,
  );

  const feeConfig = result.feeConfig ? mapFee(result.feeConfig) : null;
  const factor = frequencyFactor(result.feeConfigForCalc.frequency);

  const lineInvestorIds = result.lines.map((line) => line.investor_id);
  const calendarMonth = periodMonthRange(period);
  const flowsByInvestor = await investorModel.getPeriodCapitalFlowsBatch(
    fundId,
    lineInvestorIds,
    calendarMonth.start,
    calendarMonth.end,
  );

  const capitalByInvestor = new Map<string, InvestorCapitalContext>();
  for (const line of result.lines) {
    const flows = flowsByInvestor.get(line.investor_id) ?? {
      subscriptions: 0,
      redemptions: 0,
    };
    capitalByInvestor.set(line.investor_id, {
      grossCapital: line.gross_capital,
      transactionCharges: Math.max(0, line.gross_capital - line.net_capital),
      subscriptionDuringMonth: flows.subscriptions,
      redemptionDuringMonth: flows.redemptions,
    });
  }

  const allBreakdowns = buildAllBreakdowns(
    result.lines,
    result.netProfit,
    result.feeConfigForCalc,
    capitalByInvestor,
    {
      plNetProfit: result.plNetProfit,
      glMgmtFee: result.glMgmtFee,
      glPerfFee: result.glPerfFee,
      glFeesInPl: result.glFeesInPl,
      applyInvestorFees: result.applyInvestorFees,
      netProfitForAllocation: result.netProfit,
      periodStart: result.periodBounds.start,
      periodEnd: result.periodBounds.end,
      periodDays: inclusivePeriodDays(
        result.periodBounds.start,
        result.periodBounds.end,
      ),
      daysInMonth: daysInCalendarMonth(result.periodBounds.end),
    },
  );
  const breakdownByInvestor = Object.fromEntries(
    allBreakdowns.map((b) => [b.investorId, b]),
  );

  const filterSet =
    investorIds && investorIds.length > 0 ? new Set(investorIds) : null;
  const lines = filterSet
    ? result.lines.filter((l) => filterSet.has(l.investor_id))
    : result.lines;

  return {
    period,
    netProfit: result.netProfit,
    plNetProfit: result.plNetProfit,
    glMgmtFee: result.glMgmtFee,
    glPerfFee: result.glPerfFee,
    glFeesInPl: result.glFeesInPl,
    applyInvestorFees: result.applyInvestorFees,
    feeConfig,
    frequencyFactor: factor,
    summary: result.summary,
    lines: lines.map(allocationService.mapAllocationLine),
    breakdowns: filterSet
      ? Object.fromEntries(
          Object.entries(breakdownByInvestor).filter(([id]) =>
            filterSet.has(id),
          ),
        )
      : breakdownByInvestor,
  };
}
