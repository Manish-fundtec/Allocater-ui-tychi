import { formatPeriodLabel } from "../lib/periods";
import * as investorModel from "../models/investor.model";
import * as plReportModel from "../models/plReport.model";
import { resolveNetProfit } from "../lib/pl/netProfit";
import * as navReportEmailModel from "../models/navReportEmail.model";
import { loadPendingPlContext } from "./pendingPl.service";

export async function getDashboardStats(fundId: string) {
  const [investorRow, lastPl, pendingCtx, unsent] = await Promise.all([
    investorModel.countByFund(fundId),
    plReportModel.getLastPl(fundId),
    loadPendingPlContext(fundId),
    navReportEmailModel.countUnsentByFund(fundId),
  ]);

  return {
    totalInvestors: Number(investorRow?.count ?? 0),
    lastPLPeriod: lastPl?.period ? formatPeriodLabel(lastPl.period) : null,
    lastPLProfit: lastPl ? resolveNetProfit(lastPl) : null,
    pendingPLCount: pendingCtx.pendingPeriods.length,
    pendingPLPeriods: pendingCtx.pendingLabels,
    unsentReportsCount: Number(unsent?.count ?? 0),
  };
}
