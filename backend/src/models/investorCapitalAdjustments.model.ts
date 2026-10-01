import { query, queryOne } from "../db/pool";

export async function getTransactionCharges(
  investorId: string,
  fundId: string,
): Promise<number> {
  const row = await queryOne<{ transaction_charges: string }>(
    `SELECT COALESCE(transaction_charges, 0)::text AS transaction_charges
     FROM investor_capital_adjustments
     WHERE investor_id = $1 AND fund_id = $2`,
    [investorId, fundId],
  );
  return Number(row?.transaction_charges ?? 0);
}

export async function getTransactionChargesMap(
  fundId: string,
  investorIds: string[],
): Promise<Map<string, number>> {
  if (investorIds.length === 0) return new Map();
  const rows = await query<{ investor_id: string; transaction_charges: string }>(
    `SELECT investor_id::text AS investor_id,
            COALESCE(transaction_charges, 0)::text AS transaction_charges
     FROM investor_capital_adjustments
     WHERE fund_id = $1 AND investor_id = ANY($2::uuid[])`,
    [fundId, investorIds],
  );
  const map = new Map(
    rows.map((row) => [row.investor_id, Number(row.transaction_charges)]),
  );
  for (const id of investorIds) {
    if (!map.has(id)) map.set(id, 0);
  }
  return map;
}

export async function setTransactionCharges(
  investorId: string,
  fundId: string,
  totalCharges: number,
) {
  await query(
    `INSERT INTO investor_capital_adjustments (investor_id, fund_id, transaction_charges, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (investor_id, fund_id) DO UPDATE SET
       transaction_charges = EXCLUDED.transaction_charges,
       updated_at = NOW()`,
    [investorId, fundId, totalCharges],
  );
}
