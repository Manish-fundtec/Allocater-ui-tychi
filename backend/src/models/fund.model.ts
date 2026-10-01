import { query } from "../db/pool";
import { decryptFundField } from "../lib/encryption";

/** UI shape: { id, name, currency } mapped from Tychi `funds` table. */
export type FundListItem = {
  id: string;
  name: string;
  currency: string;
};

export async function getById(fundId: string): Promise<FundListItem | null> {
  const rows = await query<{
    fund_id: string;
    fund_name: Buffer | string | null;
    reporting_currency: string | null;
  }>(
    `SELECT fund_id::text, fund_name, reporting_currency
     FROM funds WHERE fund_id = $1::uuid`,
    [fundId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.fund_id,
    name:
      decryptFundField(r.fund_name) ?? `Fund ${r.fund_id.slice(0, 8)}`,
    currency: r.reporting_currency ?? "INR",
  };
}

export async function listFunds(): Promise<FundListItem[]> {
  const rows = await query<{
    fund_id: string;
    fund_name: Buffer | string | null;
    reporting_currency: string | null;
  }>(
    `SELECT fund_id::text, fund_name, reporting_currency
     FROM funds
     ORDER BY created_at DESC NULLS LAST`,
  );

  return rows.map((r) => ({
    id: r.fund_id,
    name:
      decryptFundField(r.fund_name) ??
      `Fund ${r.fund_id.slice(0, 8)}`,
    currency: r.reporting_currency ?? "INR",
  }));
}
