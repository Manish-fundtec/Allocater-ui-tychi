import type { PoolClient } from "pg";
import { query, queryOne } from "../db/pool";
import type { AllocationLineResult } from "../lib/allocation/calculations";
import {
  PORTAL_CAPITAL_LATERAL,
} from "../lib/portalInvestorSql";
import * as investorNavModel from "./investorNav.model";
import * as journalModel from "./journal.model";
import type { FeeAccounts } from "./journal.model";

export async function countDistinctPeriods(fundId: string) {
  return queryOne<{ count: string }>(
    `SELECT COUNT(DISTINCT period)::text AS count FROM allocation_runs WHERE fund_id = $1`,
    [fundId],
  );
}

export async function listPeriods(fundId: string) {
  return query<{ period: string }>(
    `SELECT period FROM allocation_runs WHERE fund_id = $1`,
    [fundId],
  );
}

export async function listHistory(fundId: string, limit: number) {
  return query<{
    period: string;
    total_profit: string | null;
    status: string;
    investor_count: string;
    run_at: string | null;
  }>(
    `SELECT ar.period,
            ar.total_profit::text,
            ar.status,
            COUNT(al.id)::text AS investor_count,
            ar.run_at::text
     FROM allocation_runs ar
     LEFT JOIN allocation_lines al ON al.run_id = ar.id
     WHERE ar.fund_id = $1
     GROUP BY ar.id
     ORDER BY ar.period DESC
     LIMIT $2`,
    [fundId, limit],
  );
}

export async function getLatestCompletedRun(fundId: string, period: string) {
  return queryOne<{
    id: string;
    period: string;
    total_profit: string | null;
    run_at: string;
  }>(
    `SELECT id::text, period, total_profit::text, run_at::text
     FROM allocation_runs
     WHERE fund_id = $1 AND period = $2 AND status = 'completed'
     ORDER BY run_at DESC
     LIMIT 1`,
    [fundId, period],
  );
}

export async function listCompletedRunLines(
  runId: string,
  fundId: string,
  period: string,
) {
  return query<{
    investor_id: string;
    investor_name: string;
    units: string;
    share_pct: string;
    gross_profit: string;
    mgmt_fee: string;
    perf_fee: string;
    net_profit: string;
    opening_nav: string;
    closing_nav: string;
    capital: string | null;
    gross_capital: string | null;
    share_class: string | null;
  }>(
    `SELECT al.investor_id::text AS investor_id,
            i.name AS investor_name,
            al.units::text,
            al.share_pct::text,
            al.gross_profit::text,
            al.mgmt_fee::text,
            al.perf_fee::text,
            al.net_profit::text,
            al.opening_nav::text,
            al.closing_nav::text,
            n.capital::text,
            n.gross_capital::text,
            (
              SELECT pct.class_description
              FROM portal_capital_transactions pct
              WHERE pct.investor_id = al.investor_id AND pct.fund_id = $2
                AND pct.class_description IS NOT NULL
                AND btrim(pct.class_description) <> ''
              ORDER BY COALESCE(pct.dealing_date, pct.date) DESC NULLS LAST
              LIMIT 1
            ) AS share_class
     FROM allocation_lines al
     JOIN portal_investors i ON i.investor_id = al.investor_id
     LEFT JOIN investor_nav n
       ON n.investor_id = al.investor_id
      AND n.fund_id = $2
      AND n.period = $3
     WHERE al.run_id = $1
     ORDER BY i.name`,
    [runId, fundId, period],
  );
}

export async function listInvestorHistory(investorId: string) {
  return query<{
    period: string;
    gross_profit: string;
    mgmt_fee: string;
    perf_fee: string;
    net_profit: string;
    opening_nav: string;
    closing_nav: string;
  }>(
    `SELECT ar.period,
            al.gross_profit::text,
            al.mgmt_fee::text,
            al.perf_fee::text,
            al.net_profit::text,
            al.opening_nav::text,
            al.closing_nav::text
     FROM allocation_lines al
     JOIN allocation_runs ar ON ar.id = al.run_id
     WHERE al.investor_id = $1
     ORDER BY ar.period DESC`,
    [investorId],
  );
}

export async function loadInvestorsForAllocation(
  fundId: string,
  investorIds: string[],
  period: string,
) {
  return query<{
    id: string;
    name: string;
    capital: string;
    gross_capital: string;
    share_class: string | null;
    opening_nav: string | null;
    units: string | null;
  }>(
    `SELECT i.investor_id::text AS id, i.name,
            cap.capital::text,
            cap.gross_capital::text,
            (
              SELECT pct.class_description
              FROM portal_capital_transactions pct
              WHERE pct.investor_id = i.investor_id AND pct.fund_id = i.fund_id
                AND pct.class_description IS NOT NULL
                AND btrim(pct.class_description) <> ''
              ORDER BY COALESCE(pct.dealing_date, pct.date) DESC NULLS LAST
              LIMIT 1
            ) AS share_class,
            COALESCE(n.opening_nav, n.closing_nav)::text AS opening_nav,
            n.units::text
     FROM portal_investors i
     ${PORTAL_CAPITAL_LATERAL}
     LEFT JOIN investor_nav n ON n.investor_id = i.investor_id AND n.fund_id = i.fund_id AND n.period = $3
     WHERE i.fund_id = $1 AND i.investor_id = ANY($2::uuid[])`,
    [fundId, investorIds, period],
  );
}

export async function persistAllocationRun(
  client: PoolClient,
  params: {
    fundId: string;
    period: string;
    plReportId: string;
    netProfit: number;
    runBy: string;
    lines: AllocationLineResult[];
    journalDate: string;
    mgmtFeeAmount: number;
    mgmtFeeAccounts: FeeAccounts | null;
    perfFeeAmount: number;
    perfFeeAccounts: FeeAccounts | null;
    retainedEarningCode: string | null;
  },
): Promise<{
  runId: string;
  journalId: string | null;
  perfJournalId: string | null;
  pnlJournalId: string | null;
}> {
  const run = await client.query<{ id: string }>(
    `INSERT INTO allocation_runs (fund_id, period, pl_report_id, total_profit, status, run_at, run_by)
     VALUES ($1, $2, $3, $4, 'pending', NOW(), $5)
     RETURNING id::text`,
    [
      params.fundId,
      params.period,
      params.plReportId,
      params.netProfit,
      params.runBy,
    ],
  );
  const runId = run.rows[0].id;

  for (const line of params.lines) {
    await client.query(
      `INSERT INTO allocation_lines (run_id, investor_id, units, share_pct, gross_profit, mgmt_fee, perf_fee, net_profit, opening_nav, closing_nav)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        runId,
        line.investor_id,
        line.units,
        line.share_pct,
        line.gross_profit,
        line.mgmt_fee,
        line.perf_fee,
        line.net_profit,
        line.opening_nav,
        line.closing_nav,
      ],
    );

    await investorNavModel.applyAllocationToNav(client, {
      investorId: line.investor_id,
      fundId: params.fundId,
      period: params.period,
      closingNav: line.closing_nav,
      profit: line.net_profit,
      units: line.units,
    });

    await client.query(
      `INSERT INTO nav_report_emails (investor_id, run_id, period, email_to, status)
       SELECT $1, $2, $3, i.email, 'pending' FROM portal_investors i WHERE i.investor_id = $1`,
      [line.investor_id, runId, params.period],
    );
  }

  let journalId: string | null = null;
  let perfJournalId: string | null = null;
  let pnlJournalId: string | null = null;
  if (params.mgmtFeeAccounts && params.mgmtFeeAmount > 0) {
    journalId = await journalModel.postMgmtFeeAccrualJournal(client, {
      fundId: params.fundId,
      period: params.period,
      journalDate: params.journalDate,
      amount: params.mgmtFeeAmount,
      runBy: params.runBy,
      accounts: params.mgmtFeeAccounts,
    });
  }
  if (params.perfFeeAccounts && params.perfFeeAmount > 0) {
    perfJournalId = await journalModel.postPerfFeeAccrualJournal(client, {
      fundId: params.fundId,
      period: params.period,
      journalDate: params.journalDate,
      amount: params.perfFeeAmount,
      runBy: params.runBy,
      accounts: params.perfFeeAccounts,
    });
  }
  if (params.retainedEarningCode) {
    pnlJournalId = await journalModel.postProfitAllocationJournal(client, {
      fundId: params.fundId,
      period: params.period,
      journalDate: params.journalDate,
      fundProfit: params.netProfit,
      runBy: params.runBy,
      accountCode: params.retainedEarningCode,
      lines: params.lines,
    });
  }

  await client.query(
    `UPDATE allocation_runs
     SET status = 'completed',
         journal_id = $2,
         perf_journal_id = $3,
         pnl_journal_id = $4
     WHERE id = $1`,
    [runId, journalId, perfJournalId, pnlJournalId],
  );

  return { runId, journalId, perfJournalId, pnlJournalId };
}
