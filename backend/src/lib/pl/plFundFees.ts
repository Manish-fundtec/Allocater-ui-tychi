import { roundNav } from "../nav/periodNav";
import type { GlFundFees } from "./glFundFees";

function feeAmountFromRow(row: Record<string, unknown>): number {
  const keys = [
    "mtd_amount",
    "mtd",
    "MTD",
    "month_to_date",
    "amount",
    "value",
    "balance",
  ];
  for (const key of keys) {
    const v = row[key];
    if (v != null && v !== "") return Math.abs(Number(v));
  }
  return 0;
}

function classifyPlRow(
  accountCode: string,
  accountName: string,
): "mgmt" | "perf" | null {
  const code = accountCode.trim();
  const name = accountName.toLowerCase();
  if (code === "51000" || name.includes("management fee")) return "mgmt";
  if (code === "52000" || name.includes("performance fee")) return "perf";
  return null;
}

function rowAccountCode(row: Record<string, unknown>): string {
  return String(
    row.account_code ?? row.accountCode ?? row.gl_code ?? row.glCode ?? "",
  ).trim();
}

function rowAccountName(row: Record<string, unknown>): string {
  return String(
    row.account_name ??
      row.accountName ??
      row.gl_name ??
      row.glName ??
      row.description ??
      row.label ??
      "",
  );
}

/**
 * Read fund mgmt/perf fee amounts from imported P&L snapshot (matches GL P&L report).
 */
export function parseFundFeesFromPlRaw(raw: unknown): GlFundFees | null {
  if (!raw || typeof raw !== "object") return null;

  const root = raw as Record<string, unknown>;
  const candidates: unknown[] = [];

  if (Array.isArray(root.rows)) candidates.push(...root.rows);
  if (Array.isArray(root.line_items)) candidates.push(...root.line_items);
  if (Array.isArray(root.expenses)) candidates.push(...root.expenses);
  if (Array.isArray(root.sections)) {
    for (const section of root.sections) {
      if (section && typeof section === "object") {
        const s = section as Record<string, unknown>;
        if (Array.isArray(s.rows)) candidates.push(...s.rows);
        if (Array.isArray(s.line_items)) candidates.push(...s.line_items);
      }
    }
  }

  if (candidates.length === 0) return null;

  let mgmtFee = 0;
  let perfFee = 0;

  for (const item of candidates) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const code = rowAccountCode(row);
    const name = rowAccountName(row);
    const kind = classifyPlRow(code, name);
    if (!kind) continue;
    const amount = feeAmountFromRow(row);
    if (kind === "mgmt") mgmtFee += amount;
    else perfFee += amount;
  }

  if (mgmtFee === 0 && perfFee === 0) return null;

  return {
    mgmtFee: roundNav(mgmtFee),
    perfFee: roundNav(perfFee),
    total: roundNav(mgmtFee + perfFee),
  };
}
