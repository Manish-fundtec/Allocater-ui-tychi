import { periodsBetween } from "../lib/periods";
import { loadPlSnapshotModule } from "../lib/tychi/reportRepoBridge";
import * as plReportModel from "../models/plReport.model";
import { snapshotPlForPeriod } from "./plSnapshot.service";

export async function fetchPlRange(
  fundId: string,
  periodFrom: string,
  periodTo: string,
  force = true,
) {
  const periods = periodsBetween(periodFrom, periodTo);
  const saved: string[] = [];
  const errors: { period: string; message: string }[] = [];

  for (const period of periods) {
    try {
      const result = await snapshotPlForPeriod(fundId, period, { force });
      if (!result.skipped) saved.push(period);
    } catch (e) {
      errors.push({
        period,
        message: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return { saved, errors };
}

export async function getImportHistory(fundId: string) {
  const rows = await plReportModel.importHistory(fundId);
  return rows.map((r) => ({
    period: r.period,
    net_profit: Number(r.net_profit),
    fetched_at: r.fetched_at,
    status: "saved" as const,
  }));
}

export async function testConnection() {
  try {
    loadPlSnapshotModule();
    return { connected: true };
  } catch (e) {
    return {
      connected: false,
      error: e instanceof Error ? e.message : "Tychi report repo not available",
    };
  }
}
