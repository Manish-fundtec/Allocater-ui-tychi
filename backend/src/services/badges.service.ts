import * as investorModel from "../models/investor.model";
import * as navReportEmailModel from "../models/navReportEmail.model";
import { loadPendingPlContext } from "./pendingPl.service";

export async function getBadges(fundId: string) {
  const [investors, pendingCtx, unsent] = await Promise.all([
    investorModel.countActiveByFund(fundId),
    loadPendingPlContext(fundId),
    navReportEmailModel.countUnsentByFund(fundId),
  ]);

  return {
    investorCount: Number(investors?.count ?? 0),
    pendingPLCount: pendingCtx.pendingPeriods.length,
    unsentReportsCount: Number(unsent?.count ?? 0),
  };
}
