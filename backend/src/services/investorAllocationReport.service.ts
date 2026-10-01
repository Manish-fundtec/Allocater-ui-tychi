import { ApiError } from "../lib/errors";
import { previousPeriod } from "../lib/periods";
import { query } from "../db/pool";
import { fundPlBucketsFromRaw } from "../lib/pl/parsePlRows";
import { getPeriodBounds } from "../lib/pl/periodBounds";
import {
  buildAllocationTotals,
  buildCheckRow,
  buildInvestorAllocationRow,
  applyPnlFromAdjNet,
  applyClassNavReturns,
  fundNavPerShareFromRows,
  priorClassNavPerShare,
  resolveSubscriptionIssuePrice,
  round2,
  type InvestorAllocationRow,
  type PriorNavSnapshot,
  type ReportCarryForward,
} from "../lib/reports/investorAllocationReport";
import { parseShareClass } from "../lib/allocation/investorClass";
import * as capitalAdjustmentsModel from "../models/investorCapitalAdjustments.model";
import * as allocationService from "./allocation.service";
import * as investorModel from "../models/investor.model";
import * as plReportModel from "../models/plReport.model";
import * as fundModel from "../models/fund.model";
import * as investorNavModel from "../models/investorNav.model";
import * as feeConfigModel from "../models/feeConfig.model";
import { isDealingInCalendarMonth, mgmtAccrualDays, daysInCalendarMonth } from "../lib/pl/periodDays";
import { periodMonthRange } from "../lib/pl/periodRange";

function yearEndPeriod(period: string): string {
  const year = Number(period.slice(0, 4));
  return `${year - 1}-12`;
}

async function navSnapshots(
  fundId: string,
  period: string,
): Promise<Map<string, PriorNavSnapshot>> {
  const rows = await query<{
    investor_id: string;
    net: string | null;
    units: string;
    profit: string | null;
  }>(
    `SELECT investor_id::text AS investor_id,
            COALESCE(closing_nav, opening_nav)::text AS net,
            COALESCE(units, 0)::text AS units,
            profit::text
     FROM investor_nav
     WHERE fund_id = $1::uuid AND period = $2`,
    [fundId, period],
  );
  return new Map(
    rows.map((row) => {
      const net = Number(row.net ?? 0);
      const units = Number(row.units ?? 0);
      const snapshot: PriorNavSnapshot = {
        units,
        net,
        gross: net,
        navPerShare: units > 0 && net > 0 ? net / units : null,
        pnl: row.profit != null ? Number(row.profit) : null,
      };
      return [row.investor_id, snapshot];
    }),
  );
}

async function investorCodes(
  fundId: string,
  investorIds: string[],
  namesById: Map<string, string>,
): Promise<Map<string, string>> {
  if (investorIds.length === 0) return new Map();
  const rows = await query<{
    investor_id: string;
    external_investor_id: string | null;
    name: string;
  }>(
    `SELECT investor_id::text AS investor_id, external_investor_id, name
     FROM portal_investors
     WHERE fund_id = $1::uuid AND investor_id = ANY($2::uuid[])`,
    [fundId, investorIds],
  );
  const byName: Record<string, string> = {
    "Bing Yang": "BTMF0001",
    "Fei Zou": "BTMF0002",
    "Yang Lu": "BTMF0003",
    "Chi Zheng": "BTMF0004",
    "Jiachen Tang": "BTMF0005",
    "Wang Pang": "BTMF0006",
    "Wendi Zhang": "BTMF0007",
  };
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return new Map(
    rows.map((row) => {
      const external = (row.external_investor_id ?? "").trim();
      const name = (row.name ?? namesById.get(row.investor_id) ?? "").trim();
      const mapped = byName[name];
      const code =
        external && !uuidRe.test(external)
          ? external
          : mapped || external || name;
      return [row.investor_id, code];
    }),
  );
}

export type InvestorAllocationReportResult = {
  allocated: boolean;
  fundId: string;
  fundName: string;
  period: string;
  asOfDate: string;
  hurdleRate: number;
  perfFeePct: number;
  perfTierPct: number;
  rows: InvestorAllocationRow[];
  totals: InvestorAllocationRow;
  check: InvestorAllocationRow;
};

export async function getInvestorAllocationReport(
  fundId: string,
  period: string,
  cache: Map<string, InvestorAllocationReportResult> = new Map(),
): Promise<InvestorAllocationReportResult> {
  const cacheKey = `${fundId}:${period}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const fund = await fundModel.getById(fundId);
  if (!fund) throw new ApiError("Fund not found", 404);

  const completed = await allocationService.getCompletedAllocationLines(
    fundId,
    period,
  );
  if (!completed) {
    const calendarMonth = periodMonthRange(period);
    const empty = {
      allocated: false,
      fundId,
      fundName: fund.name,
      period,
      asOfDate: calendarMonth.end,
      hurdleRate: 5,
      perfFeePct: 20,
      perfTierPct: 30,
      rows: [] as InvestorAllocationRow[],
      totals: buildAllocationTotals([]),
      check: buildCheckRow([], buildAllocationTotals([])),
    };
    cache.set(cacheKey, empty);
    return empty;
  }

  const lines = completed.lines;
  const investorIds = lines.map((line) => line.investor_id);

  const bounds = await getPeriodBounds(fundId, period);
  const calendarMonth = periodMonthRange(period);
  const [codes, flows, charges, priorMtd, priorYtd, rawPl, feeRow, latestFee, shareClasses] =
    await Promise.all([
      investorCodes(
        fundId,
        investorIds,
        new Map(lines.map((l) => [l.investor_id, l.investor_name])),
      ),
      investorModel.getPeriodCapitalFlowsBatch(
        fundId,
        investorIds,
        calendarMonth.start,
        calendarMonth.end,
      ),
      capitalAdjustmentsModel.getTransactionChargesMap(fundId, investorIds),
      navSnapshots(fundId, previousPeriod(period)),
      navSnapshots(fundId, yearEndPeriod(period)),
      plReportModel.getRawJson(fundId, period),
      feeConfigModel.getFeeForPeriod(fundId, bounds.end),
      feeConfigModel.getFeeForAllocation(fundId),
      investorModel.getInvestorShareClassMap(
        fundId,
        investorIds,
        calendarMonth.start,
        calendarMonth.end,
      ),
    ]);

  const firstDealingDates = await investorModel.getInvestorFirstDealingDates(
    fundId,
    investorIds,
  );
  const dealingInMonth = await investorModel.getInvestorDealingDatesInMonth(
    fundId,
    investorIds,
    period,
  );

  const priorPeriod = previousPeriod(period);
  const priorCompleted = await allocationService.getCompletedAllocationLines(
    fundId,
    priorPeriod,
  );
  const priorCarry = new Map<string, ReportCarryForward>();
  let priorRows: InvestorAllocationRow[] = [];
  if (priorCompleted) {
    const priorReport = await getInvestorAllocationReport(
      fundId,
      priorPeriod,
      cache,
    );
    priorRows = priorReport.rows;
    for (const row of priorReport.rows) {
      priorCarry.set(row.investorId, {
        closingYtdPnl: row.closingYtdPnl,
        ytdMgmtFees: round2(
          (Number(row.openingYtdMgmtFees) || 0) +
            (Number(row.mtdMgmtFees) || 0),
        ),
        adjHighWaterMark: row.adjHighWaterMark,
        originalIssuePrice: row.originalIssuePrice,
        netYtdCompounded: row.netYtdCompounded,
        accruedPerfFee: row.perfFeesAccrued,
        subscriptionDate: row.subscriptionDate,
      });
    }
  }
  const priorReportById = new Map(
    priorRows.map((row) => [row.investorId, row]),
  );
  const livePriorMtd = await allocationService.getLivePriorClosing(
    fundId,
    previousPeriod(period),
    investorIds,
  );
  const inceptionPeriod = lines.every((line) =>
    isDealingInCalendarMonth(firstDealingDates.get(line.investor_id), period),
  );
  const prevNavPerShare = inceptionPeriod
    ? null
    : await investorNavModel.getFundClosingNavPerShare(
        fundId,
        previousPeriod(period),
      );
  const liveFundNav =
    livePriorMtd.size > 0
      ? (() => {
          let net = 0;
          let units = 0;
          for (const close of livePriorMtd.values()) {
            net += close.net;
            units += close.units;
          }
          return units > 0 ? net / units : null;
        })()
      : null;
  const priorFundNav =
    fundNavPerShareFromRows(priorRows) ?? liveFundNav ?? prevNavPerShare;

  const fundPl = fundPlBucketsFromRaw(rawPl);
  const rows: InvestorAllocationRow[] = lines.map((line) => {
    const joinedThisPeriod = isDealingInCalendarMonth(
      firstDealingDates.get(line.investor_id),
      period,
    );
    const live = livePriorMtd.get(line.investor_id);
    const stored = priorMtd.get(line.investor_id) ?? null;
    const priorReportRow = priorReportById.get(line.investor_id);
    const fromReport: PriorNavSnapshot | null =
      priorReportRow && (Number(priorReportRow.closingNet) || 0) > 0.005
        ? {
            units: Number(priorReportRow.closingShares) || 0,
            net: Number(priorReportRow.closingNet) || 0,
            gross:
              Number(priorReportRow.closingGross) ||
              Number(priorReportRow.closingNet) ||
              0,
            navPerShare:
              priorReportRow.closingNavPerShare ??
              ((Number(priorReportRow.closingShares) || 0) > 0
                ? (Number(priorReportRow.closingNet) || 0) /
                  (Number(priorReportRow.closingShares) || 1)
                : null),
            pnl: priorReportRow.closingYtdPnl,
          }
        : null;
    const priorSnapshot: PriorNavSnapshot | null =
      fromReport ??
      (live
        ? {
            units: live.units,
            net: live.net,
            gross: live.net,
            navPerShare: live.units > 0 ? live.net / live.units : null,
            pnl: stored?.pnl ?? null,
          }
        : stored);
    const hasPriorMtd =
      !joinedThisPeriod &&
      priorSnapshot != null &&
      priorSnapshot.net > 0.005;
    const code = codes.get(line.investor_id) || "";
    const portalClass =
      shareClasses.get(line.investor_id) ?? line.share_class;
    const terms =
      parseShareClass(portalClass) ??
      (portalClass?.trim() ? portalClass.trim() : "A");
    const issuePrice = resolveSubscriptionIssuePrice({
      inceptionPeriod,
      joinedThisPeriod,
      priorNavPerShare: hasPriorMtd ? priorSnapshot?.navPerShare : null,
      classNavPerShare: priorClassNavPerShare(priorRows, terms),
      fundNavPerShare: priorFundNav,
    });
    return buildInvestorAllocationRow({
      line: { ...line, share_class: portalClass },
      investorCode: code || line.investor_name,
      priorMtd: hasPriorMtd ? priorSnapshot : null,
      priorYtd: joinedThisPeriod
        ? null
        : (priorYtd.get(line.investor_id) ?? null),
      flow: {
        ...(flows.get(line.investor_id) ?? {
          subscriptions: 0,
          redemptions: 0,
        }),
        transactionCharges: charges.get(line.investor_id) ?? 0,
      },
      issuePrice,
      fundPl,
      joinedThisPeriod,
      inceptionPeriod,
      carry: joinedThisPeriod
        ? null
        : (priorCarry.get(line.investor_id) ?? null),
      subscriptionDate: firstDealingDates.get(line.investor_id) ?? null,
      navDate: bounds.end,
    });
  });

  rows.sort((a, b) =>
    a.investorCode.localeCompare(b.investorCode, "en", { numeric: true }),
  );

  const fee = feeRow ?? latestFee;
  const fundNetMtd =
    completed.totalProfit != null && Number.isFinite(completed.totalProfit)
      ? completed.totalProfit
      : lines.reduce((sum, line) => sum + Number(line.gross_profit), 0);
  const daysInMonth = daysInCalendarMonth(calendarMonth.end);
  const mgmtDaysById = new Map(
    investorIds.map((id) => {
      const joinedThisPeriod = isDealingInCalendarMonth(
        firstDealingDates.get(id),
        period,
      );
      // First month in an already-running fund: charge the full month.
      // Fund inception month still prorates from the first dealing date.
      if (joinedThisPeriod && !inceptionPeriod) {
        return [id, daysInMonth];
      }
      const dealing = joinedThisPeriod
        ? (dealingInMonth.get(id) ?? firstDealingDates.get(id) ?? null)
        : null;
      return [
        id,
        mgmtAccrualDays(calendarMonth.start, calendarMonth.end, dealing),
      ];
    }),
  );
  applyPnlFromAdjNet(rows, fundPl, fundNetMtd, {
    mgmtFeePct: Number(fee?.mgmt_fee_pct) || 0,
    hurdleRatePct: Number(fee?.hurdle_rate_pct) || 5,
    perfFeePct: Number(fee?.perf_fee_pct) > 0 ? Number(fee?.perf_fee_pct) : 20,
    daysInMonth,
    mgmtDaysById,
    applyFees: fee != null,
    navDate: bounds.end,
    subscriptionDateById: firstDealingDates,
  });
  applyClassNavReturns(rows, inceptionPeriod ? 2000 : null);

  const totals = buildAllocationTotals(rows);
  const check = buildCheckRow(rows, totals);

  const result = {
    allocated: true as const,
    fundId,
    fundName: fund.name,
    period,
    asOfDate: bounds.end,
    hurdleRate: 5,
    perfFeePct: Number(fee?.perf_fee_pct) > 0 ? Number(fee?.perf_fee_pct) : 20,
    perfTierPct: 30,
    rows,
    totals,
    check,
  };
  cache.set(cacheKey, result);
  return result;
}
