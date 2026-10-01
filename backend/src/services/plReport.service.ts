import * as plReportModel from "../models/plReport.model";
import {
  allocationStatusForPeriod,
  loadPendingPlContext,
  periodDisplayLabel,
  periodKeyFromEndDate,
} from "./pendingPl.service";
import { resolveNetProfit } from "../lib/pl/netProfit";

export async function listPlReports(fundId: string) {
  const [reports, ctx] = await Promise.all([
    plReportModel.listByFund(fundId),
    loadPendingPlContext(fundId),
  ]);

  const reportMap = new Map(reports.map((r) => [r.period, r]));

  return ctx.reportingPeriods.map((rp) => {
    const period = periodKeyFromEndDate(rp.end_date);
    const r = reportMap.get(period);
    return {
      id: r?.id ?? null,
      period,
      period_label: periodDisplayLabel(rp),
      net_profit: r ? resolveNetProfit(r) : null,
      gross_revenue: r ? Number(r.gross_revenue) : null,
      total_expenses: r ? Number(r.total_expenses) : null,
      fetched_at: r?.fetched_at ?? null,
      allocation_status: allocationStatusForPeriod(
        rp,
        ctx.fetchedSet,
        ctx.allocatedSet,
      ),
      valuation_status: rp.status,
    };
  });
}
