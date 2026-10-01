import { query, queryOne } from "../db/pool";
import {
  ACTIVE_HAVING,
  EXITED_HAVING,
  PORTAL_CAPITAL_LATERAL,
  PORTAL_INVESTOR_STATUS_SQL,
} from "../lib/portalInvestorSql";
import * as capitalAdjustmentsModel from "./investorCapitalAdjustments.model";
import { periodMonthRange } from "../lib/pl/periodRange";
import { PORTAL_EFFECTIVE_DEALING_DATE } from "../lib/portalCapitalSql";

export async function countActiveByFund(fundId: string) {
  return queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM portal_investors i
     ${PORTAL_CAPITAL_LATERAL}
     WHERE i.fund_id = $1 AND ${ACTIVE_HAVING}`,
    [fundId],
  );
}

export async function countByFund(fundId: string) {
  return queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM portal_investors WHERE fund_id = $1`,
    [fundId],
  );
}

export async function listInvestors(
  fundId: string,
  status: "all" | "active" | "exited",
  search: string,
) {
  const conditions = ["i.fund_id = $1"];
  const values: unknown[] = [fundId];
  let idx = 2;

  if (status === "active") {
    conditions.push(ACTIVE_HAVING);
  } else if (status === "exited") {
    conditions.push(EXITED_HAVING);
  }

  if (search) {
    conditions.push(
      `(i.name ILIKE $${idx} OR i.email ILIKE $${idx} OR i.full_legal_name ILIKE $${idx})`,
    );
    values.push(`%${search}%`);
    idx++;
  }

  return query<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    capital: string;
    gross_capital: string;
    transaction_charges: string;
    status: string;
    created_at: string;
    current_closing_nav: string | null;
    nav_period: string | null;
  }>(
    `SELECT i.investor_id::text AS id, i.name, i.email,
            NULL::text AS phone,
            cap.capital::text,
            cap.gross_capital::text,
            cap.transaction_charges::text,
            ${PORTAL_INVESTOR_STATUS_SQL} AS status,
            i.created_at::text,
            nav.closing_nav::text AS current_closing_nav,
            nav.period AS nav_period
     FROM portal_investors i
     ${PORTAL_CAPITAL_LATERAL}
     LEFT JOIN LATERAL (
       SELECT closing_nav, period FROM investor_nav
       WHERE investor_id = i.investor_id AND fund_id = i.fund_id
       ORDER BY period DESC LIMIT 1
     ) nav ON true
     WHERE ${conditions.join(" AND ")}
     ORDER BY i.name`,
    values,
  );
}

export async function getInvestorById(id: string) {
  return queryOne<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    capital: string;
    status: string;
    created_at: string;
    fund_id: string;
    fund_name: Buffer | string | null;
  }>(
    `SELECT i.investor_id::text AS id, i.fund_id::text, i.name, i.email,
            NULL::text AS phone,
            cap.capital::text,
            ${PORTAL_INVESTOR_STATUS_SQL} AS status,
            i.created_at::text, f.fund_name
     FROM portal_investors i
     ${PORTAL_CAPITAL_LATERAL}
     JOIN funds f ON f.fund_id = i.fund_id
     WHERE i.investor_id = $1`,
    [id],
  );
}

export async function updateInvestor(id: string, email?: string) {
  if (!email) return;
  await query(`UPDATE portal_investors SET email = $1, updated_at = NOW() WHERE investor_id = $2`, [
    email,
    id,
  ]);
}

export async function getInvestorCapital(investorId: string, fundId: string) {
  return getInvestorCapitalBreakdown(investorId, fundId);
}

export async function getPeriodCapitalFlows(
  investorId: string,
  fundId: string,
  startDate: string,
  endDate: string,
) {
  const map = await getPeriodCapitalFlowsBatch(
    fundId,
    [investorId],
    startDate,
    endDate,
  );
  return (
    map.get(investorId) ?? { subscriptions: 0, redemptions: 0 }
  );
}

export async function getPeriodCapitalFlowsBatch(
  fundId: string,
  investorIds: string[],
  startDate: string,
  endDate: string,
): Promise<
  Map<string, { subscriptions: number; redemptions: number }>
> {
  if (investorIds.length === 0) return new Map();

  const rows = await query<{
    investor_id: string;
    subscriptions: string;
    redemptions: string;
  }>(
    `SELECT pct.investor_id::text AS investor_id,
            COALESCE(SUM(pct.subscription_amount), 0)::text AS subscriptions,
            COALESCE(SUM(pct.redemption_amount), 0)::text AS redemptions
     FROM portal_capital_transactions pct
     WHERE pct.fund_id = $1::uuid
       AND pct.investor_id = ANY($2::uuid[])
       AND ${PORTAL_EFFECTIVE_DEALING_DATE} >= $3::date
       AND ${PORTAL_EFFECTIVE_DEALING_DATE} <= $4::date
     GROUP BY pct.investor_id`,
    [fundId, investorIds, startDate, endDate],
  );

  const map = new Map(
    rows.map((r) => [
      r.investor_id,
      {
        subscriptions: Number(r.subscriptions),
        redemptions: Number(r.redemptions),
      },
    ]),
  );
  for (const id of investorIds) {
    if (!map.has(id)) {
      map.set(id, { subscriptions: 0, redemptions: 0 });
    }
  }
  return map;
}

/**
 * Share class from portal_capital_transactions.class_description.
 * Prefers a non-empty class on a dealing in [start, end], else latest non-empty.
 */
export async function getInvestorShareClassMap(
  fundId: string,
  investorIds: string[],
  startDate?: string,
  endDate?: string,
): Promise<Map<string, string>> {
  if (investorIds.length === 0) return new Map();

  const rows = await query<{
    investor_id: string;
    class_description: string | null;
  }>(
    `SELECT investor_id::text AS investor_id, class_description
     FROM (
       SELECT pct.investor_id,
              pct.class_description,
              ROW_NUMBER() OVER (
                PARTITION BY pct.investor_id
                ORDER BY
                  CASE
                    WHEN $3::date IS NOT NULL
                     AND ${PORTAL_EFFECTIVE_DEALING_DATE} >= $3::date
                     AND ${PORTAL_EFFECTIVE_DEALING_DATE} <= $4::date
                    THEN 0
                    ELSE 1
                  END,
                  ${PORTAL_EFFECTIVE_DEALING_DATE} DESC NULLS LAST
              ) AS rn
       FROM portal_capital_transactions pct
       WHERE pct.fund_id = $1::uuid
         AND pct.investor_id = ANY($2::uuid[])
         AND pct.class_description IS NOT NULL
         AND btrim(pct.class_description) <> ''
     ) ranked
     WHERE rn = 1`,
    [fundId, investorIds, startDate ?? null, endDate ?? null],
  );

  return new Map(
    rows.map((row) => [row.investor_id, (row.class_description ?? "").trim()]),
  );
}

/** First subscription dealing date per investor (fund inception for that investor). */
export async function getInvestorFirstDealingDates(
  fundId: string,
  investorIds: string[],
): Promise<Map<string, string>> {
  if (investorIds.length === 0) return new Map();

  const rows = await query<{
    investor_id: string;
    dealing_date: string;
  }>(
    `SELECT pct.investor_id::text AS investor_id,
            MIN(${PORTAL_EFFECTIVE_DEALING_DATE})::text AS dealing_date
     FROM portal_capital_transactions pct
     WHERE pct.fund_id = $1::uuid
       AND pct.investor_id = ANY($2::uuid[])
       AND pct.subscription_amount > 0
     GROUP BY pct.investor_id`,
    [fundId, investorIds],
  );

  return new Map(
    rows.map((r) => [r.investor_id, r.dealing_date.trim().slice(0, 10)]),
  );
}

/** Earliest dealing date per investor in a calendar month (for mgmt fee accrual). */
export async function getInvestorDealingDatesInMonth(
  fundId: string,
  investorIds: string[],
  period: string,
): Promise<Map<string, string>> {
  if (investorIds.length === 0) return new Map();

  const cal = periodMonthRange(period);
  const rows = await query<{
    investor_id: string;
    dealing_date: string;
  }>(
    `SELECT pct.investor_id::text AS investor_id,
            MIN(${PORTAL_EFFECTIVE_DEALING_DATE})::text AS dealing_date
     FROM portal_capital_transactions pct
     WHERE pct.fund_id = $1::uuid
       AND pct.investor_id = ANY($2::uuid[])
       AND ${PORTAL_EFFECTIVE_DEALING_DATE} >= $3::date
       AND ${PORTAL_EFFECTIVE_DEALING_DATE} <= $4::date
       AND pct.subscription_amount > 0
     GROUP BY pct.investor_id`,
    [fundId, investorIds, cal.start, cal.end],
  );

  return new Map(
    rows.map((r) => [r.investor_id, r.dealing_date.trim().slice(0, 10)]),
  );
}

export async function getFirstSubscriptionDatesInPeriod(
  fundId: string,
  investorIds: string[],
  startDate: string,
  endDate: string,
): Promise<Map<string, string>> {
  if (investorIds.length === 0) return new Map();

  const rows = await query<{
    investor_id: string;
    first_date: string;
  }>(
    `SELECT investor_id::text AS investor_id, MIN(date)::text AS first_date
     FROM portal_capital_transactions
     WHERE fund_id = $1::uuid
       AND investor_id = ANY($2::uuid[])
       AND date >= $3::date
       AND date <= $4::date
       AND subscription_amount > 0
     GROUP BY investor_id`,
    [fundId, investorIds, startDate, endDate],
  );

  return new Map(
    rows.map((r) => [r.investor_id, r.first_date.trim().slice(0, 10)]),
  );
}

export async function getInvestorCapitalBreakdown(
  investorId: string,
  fundId: string,
) {
  const grossRow = await queryOne<{ gross_capital: string }>(
    `SELECT COALESCE(SUM(pct.subscription_amount - pct.redemption_amount), 0)::text AS gross_capital
     FROM portal_capital_transactions pct
     WHERE pct.investor_id = $1 AND pct.fund_id = $2`,
    [investorId, fundId],
  );
  const grossCapital = Number(grossRow?.gross_capital ?? 0);
  const transactionCharges =
    await capitalAdjustmentsModel.getTransactionCharges(investorId, fundId);

  return {
    gross_capital: grossCapital.toString(),
    transaction_charges: transactionCharges.toString(),
    capital: (grossCapital - transactionCharges).toString(),
  };
}

export async function setInvestorTransactionCharges(
  investorId: string,
  fundId: string,
  totalCharges: number,
) {
  await capitalAdjustmentsModel.setTransactionCharges(
    investorId,
    fundId,
    totalCharges,
  );
}

export type RegisterInvestorRow = {
  id: string;
  investor_code: string | null;
  name: string;
  legal_name: string | null;
  email: string;
  investor_type: string | null;
  mailing_address: string | null;
  share_class: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  first_dealing_date: string | null;
  last_dealing_date: string | null;
  first_trade_date: string | null;
  last_trade_date: string | null;
  dealing_count: string;
  gross_capital: string;
  transaction_charges: string;
  capital: string;
  current_closing_nav: string | null;
  nav_period: string | null;
};

export async function listRegisterInvestors(fundId: string) {
  return query<RegisterInvestorRow>(
    `SELECT i.investor_id::text AS id,
            i.external_investor_id AS investor_code,
            i.name,
            i.full_legal_name AS legal_name,
            i.email,
            i.investor_type,
            i.mailing_address,
            d.share_class,
            ${PORTAL_INVESTOR_STATUS_SQL} AS status,
            i.created_at::text,
            i.updated_at::text,
            d.first_dealing_date::text,
            d.last_dealing_date::text,
            d.first_trade_date::text,
            d.last_trade_date::text,
            COALESCE(d.dealing_count, 0)::text AS dealing_count,
            cap.gross_capital::text,
            cap.transaction_charges::text,
            cap.capital::text,
            nav.closing_nav::text AS current_closing_nav,
            nav.period AS nav_period
     FROM portal_investors i
     ${PORTAL_CAPITAL_LATERAL}
     LEFT JOIN LATERAL (
       SELECT MIN(${PORTAL_EFFECTIVE_DEALING_DATE})::date AS first_dealing_date,
              MAX(${PORTAL_EFFECTIVE_DEALING_DATE})::date AS last_dealing_date,
              MIN(pct.date)::date AS first_trade_date,
              MAX(pct.date)::date AS last_trade_date,
              COUNT(*)::int AS dealing_count,
              (
                array_agg(pct.class_description ORDER BY ${PORTAL_EFFECTIVE_DEALING_DATE} DESC NULLS LAST)
                FILTER (WHERE pct.class_description IS NOT NULL AND btrim(pct.class_description) <> '')
              )[1] AS share_class
       FROM portal_capital_transactions pct
       WHERE pct.fund_id = i.fund_id AND pct.investor_id = i.investor_id
     ) d ON true
     LEFT JOIN LATERAL (
       SELECT closing_nav, period FROM investor_nav
       WHERE investor_id = i.investor_id AND fund_id = i.fund_id
       ORDER BY period DESC LIMIT 1
     ) nav ON true
     WHERE i.fund_id = $1::uuid
     ORDER BY i.name`,
    [fundId],
  );
}

export type RegisterDealingRow = {
  investor_id: string;
  investor_name: string;
  investor_code: string | null;
  trade_date: string;
  dealing_date: string | null;
  effective_dealing_date: string;
  type: string;
  amount: string;
  shares: string | null;
  share_class: string | null;
  notes: string | null;
  created_at: string | null;
};

export async function listRegisterDealings(fundId: string) {
  return query<RegisterDealingRow>(
    `SELECT pct.investor_id::text AS investor_id,
            i.name AS investor_name,
            i.external_investor_id AS investor_code,
            pct.date::text AS trade_date,
            pct.dealing_date::text AS dealing_date,
            ${PORTAL_EFFECTIVE_DEALING_DATE}::text AS effective_dealing_date,
            CASE
              WHEN COALESCE(pct.redemption_amount, 0) > 0 THEN 'redemption'
              ELSE 'subscription'
            END AS type,
            CASE
              WHEN COALESCE(pct.redemption_amount, 0) > 0 THEN pct.redemption_amount
              ELSE pct.subscription_amount
            END::text AS amount,
            pct.shares::text,
            pct.class_description AS share_class,
            pct.notes,
            COALESCE(pct.portal_created_at, pct.created_at)::text AS created_at
     FROM portal_capital_transactions pct
     JOIN portal_investors i ON i.investor_id = pct.investor_id
     WHERE pct.fund_id = $1::uuid
     ORDER BY ${PORTAL_EFFECTIVE_DEALING_DATE} ASC, i.name ASC`,
    [fundId],
  );
}
