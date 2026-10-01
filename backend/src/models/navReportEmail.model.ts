import { query, queryOne } from "../db/pool";

export async function countUnsentByFund(fundId: string) {
  return queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM nav_report_emails nre
     JOIN allocation_runs ar ON ar.id = nre.run_id
     WHERE ar.fund_id = $1 AND nre.status IN ('pending', 'failed')`,
    [fundId],
  );
}

export async function listUnsent(fundId: string) {
  return query<{
    id: string;
    investor_id: string;
    investor_name: string;
    investor_email: string;
    period: string;
    closing_nav: string;
    status: string;
    run_id: string;
    error_msg: string | null;
  }>(
    `SELECT nre.id::text, nre.investor_id::text, i.name AS investor_name, i.email AS investor_email,
            nre.period, al.closing_nav::text, nre.status, nre.run_id::text, nre.error_msg
     FROM nav_report_emails nre
     JOIN portal_investors i ON i.investor_id = nre.investor_id
     JOIN allocation_lines al ON al.run_id = nre.run_id AND al.investor_id = nre.investor_id
     JOIN allocation_runs ar ON ar.id = nre.run_id
     WHERE ar.fund_id = $1 AND nre.status IN ('pending', 'failed')
     ORDER BY nre.period DESC, i.name`,
    [fundId],
  );
}

export async function listAll(fundId: string) {
  return query<{
    id: string;
    investor_id: string;
    investor_name: string;
    investor_email: string;
    period: string;
    closing_nav: string;
    status: string;
    run_id: string;
    sent_at: string | null;
    error_msg: string | null;
  }>(
    `SELECT nre.id::text, nre.investor_id::text, i.name AS investor_name, i.email AS investor_email,
            nre.period, al.closing_nav::text, nre.status, nre.run_id::text, nre.sent_at::text, nre.error_msg
     FROM nav_report_emails nre
     JOIN portal_investors i ON i.investor_id = nre.investor_id
     JOIN allocation_lines al ON al.run_id = nre.run_id AND al.investor_id = nre.investor_id
     JOIN allocation_runs ar ON ar.id = nre.run_id
     WHERE ar.fund_id = $1
     ORDER BY nre.period DESC, i.name`,
    [fundId],
  );
}

export async function getPreviewRow(investorId: string, runId: string) {
  return queryOne<{
    investor_name: string;
    fund_name: Buffer | string | null;
    period: string;
    closing_nav: string;
  }>(
    `SELECT i.name AS investor_name, f.fund_name, nre.period, al.closing_nav::text
     FROM nav_report_emails nre
     JOIN portal_investors i ON i.investor_id = nre.investor_id
     JOIN funds f ON f.fund_id = i.fund_id
     JOIN allocation_lines al ON al.run_id = nre.run_id AND al.investor_id = nre.investor_id
     WHERE nre.investor_id = $1 AND nre.run_id = $2`,
    [investorId, runId],
  );
}

export async function getSendRow(investorId: string, runId: string) {
  return queryOne<{
    id: string;
    email_to: string;
    period: string;
    investor_name: string;
    fund_name: Buffer | string | null;
    closing_nav: string;
  }>(
    `SELECT nre.id::text, nre.email_to, nre.period, i.name AS investor_name, f.fund_name, al.closing_nav::text
     FROM nav_report_emails nre
     JOIN portal_investors i ON i.investor_id = nre.investor_id
     JOIN funds f ON f.fund_id = i.fund_id
     JOIN allocation_lines al ON al.run_id = nre.run_id AND al.investor_id = nre.investor_id
     WHERE nre.investor_id = $1 AND nre.run_id = $2`,
    [investorId, runId],
  );
}

export async function listPendingForRun(runId: string) {
  return query<{
    id: string;
    investor_id: string;
    email_to: string;
    period: string;
    investor_name: string;
    fund_name: Buffer | string | null;
    closing_nav: string;
  }>(
    `SELECT nre.id::text, nre.investor_id::text, nre.email_to, nre.period,
            i.name AS investor_name, f.fund_name, al.closing_nav::text
     FROM nav_report_emails nre
     JOIN portal_investors i ON i.investor_id = nre.investor_id
     JOIN funds f ON f.fund_id = i.fund_id
     JOIN allocation_lines al ON al.run_id = nre.run_id AND al.investor_id = nre.investor_id
     WHERE nre.run_id = $1 AND nre.status IN ('pending', 'failed')`,
    [runId],
  );
}

export async function markSent(id: string) {
  await query(
    `UPDATE nav_report_emails SET status = 'sent', sent_at = NOW(), error_msg = NULL WHERE id = $1`,
    [id],
  );
}

export async function markFailed(id: string, msg: string) {
  await query(
    `UPDATE nav_report_emails SET status = 'failed', error_msg = $2 WHERE id = $1`,
    [id, msg],
  );
}
