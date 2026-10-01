import { ApiError } from "../lib/errors";
import { previousPeriod } from "../lib/periods";
import { query } from "../db/pool";
import { buildInvestorStatement } from "../lib/reports/investorStatement";
import type { PriorNavSnapshot } from "../lib/reports/investorAllocationReport";
import * as allocationService from "./allocation.service";
import * as investorModel from "../models/investor.model";
import * as fundModel from "../models/fund.model";
import * as investorNavModel from "../models/investorNav.model";
import { getPeriodBounds } from "../lib/pl/periodBounds";
import { periodMonthRange } from "../lib/pl/periodRange";

function yearEndPeriod(period: string): string {
  const year = Number(period.slice(0, 4));
  return `${year - 1}-12`;
}

function yearStartDate(period: string): string {
  return `${period.slice(0, 4)}-01-01`;
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

async function investorMeta(
  fundId: string,
  investorIds: string[],
): Promise<Map<string, { code: string; displayName: string }>> {
  if (investorIds.length === 0) return new Map();
  const rows = await query<{
    investor_id: string;
    external_investor_id: string | null;
    name: string;
    full_legal_name: string | null;
  }>(
    `SELECT investor_id::text AS investor_id,
            external_investor_id,
            name,
            full_legal_name
     FROM portal_investors
     WHERE fund_id = $1::uuid AND investor_id = ANY($2::uuid[])`,
    [fundId, investorIds],
  );
  return new Map(
    rows.map((row) => {
      const legal = (row.full_legal_name ?? "").trim();
      const name = (row.name ?? "").trim();
      return [
        row.investor_id,
        {
          code: (row.external_investor_id ?? "").trim(),
          displayName: legal || name,
        },
      ];
    }),
  );
}

export async function getInvestorStatements(
  fundId: string,
  period: string,
  investorId?: string,
) {
  const fund = await fundModel.getById(fundId);
  if (!fund) throw new ApiError("Fund not found", 404);

  const completed = await allocationService.getCompletedAllocationLines(
    fundId,
    period,
  );
  if (!completed) {
    return {
      allocated: false,
      fundId,
      fundName: fund.name,
      currency: fund.currency || "USD",
      period,
      periodFrom: null,
      periodTo: null,
      investors: [],
      statement: null,
    };
  }

  const resultLines = completed.lines;
  const bounds = await getPeriodBounds(fundId, period);
  const calendarMonth = periodMonthRange(period);

  const meta = await investorMeta(
    fundId,
    resultLines.map((line) => line.investor_id),
  );

  const investorOptions = resultLines.map((line) => {
    const info = meta.get(line.investor_id);
    return {
      investorId: line.investor_id,
      investorName: info?.displayName || line.investor_name,
      investorCode: info?.code || line.investor_name,
    };
  });

  if (!investorId) {
    return {
      allocated: true,
      fundId,
      fundName: fund.name,
      currency: fund.currency || "USD",
      period,
      periodFrom: bounds.start,
      periodTo: bounds.end,
      investors: investorOptions,
      statement: null,
    };
  }

  const line = resultLines.find((l) => l.investor_id === investorId);
  if (!line) {
    throw new ApiError("Investor is not in this period's allocation", 404);
  }

  const ytdStart = yearStartDate(period);
  const [mtdFlows, ytdFlows, priorMtd, priorYtd, issuePrice] =
    await Promise.all([
      investorModel.getPeriodCapitalFlowsBatch(
        fundId,
        [investorId],
        calendarMonth.start,
        calendarMonth.end,
      ),
      investorModel.getPeriodCapitalFlowsBatch(
        fundId,
        [investorId],
        ytdStart,
        bounds.end,
      ),
      navSnapshots(fundId, previousPeriod(period)),
      navSnapshots(fundId, yearEndPeriod(period)),
      investorNavModel.getManualNavPerShare(fundId, period),
    ]);

  const info = meta.get(investorId);
  const statement = buildInvestorStatement({
    line,
    investorCode: info?.code || line.investor_name,
    investorName: info?.displayName || line.investor_name,
    priorMtd: priorMtd.get(investorId) ?? null,
    priorYtd: priorYtd.get(investorId) ?? null,
    mtdFlow: mtdFlows.get(investorId) ?? {
      subscriptions: 0,
      redemptions: 0,
    },
    ytdFlow: ytdFlows.get(investorId) ?? {
      subscriptions: 0,
      redemptions: 0,
    },
    issuePrice,
  });

  return {
    allocated: true,
    fundId,
    fundName: fund.name,
    currency: fund.currency || "USD",
    period,
    periodFrom: bounds.start,
    periodTo: bounds.end,
    investors: investorOptions,
    statement,
  };
}
