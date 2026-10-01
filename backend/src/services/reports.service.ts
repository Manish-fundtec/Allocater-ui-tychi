import { ApiError } from "../lib/errors";
import { decryptFundField } from "../lib/encryption";
import {
  buildNavReportHtml,
  getMailer,
} from "../lib/email/navReport";
import * as navReportEmailModel from "../models/navReportEmail.model";

function mapReport(r: {
  id: string;
  investor_id: string;
  investor_name: string;
  investor_email: string;
  period: string;
  closing_nav: string;
  status: string;
  run_id: string;
  error_msg?: string | null;
  sent_at?: string | null;
}) {
  return {
    id: r.id,
    investor_id: r.investor_id,
    investor_name: r.investor_name,
    investor_email: r.investor_email,
    period: r.period,
    closing_nav: Number(r.closing_nav),
    open_nav: Number(r.closing_nav),
    status: r.status,
    run_id: r.run_id,
    error_msg: r.error_msg ?? undefined,
    sent_at: r.sent_at ?? undefined,
  };
}

export async function listUnsent(fundId: string) {
  const rows = await navReportEmailModel.listUnsent(fundId);
  return rows.map(mapReport);
}

export async function listAll(fundId: string) {
  const rows = await navReportEmailModel.listAll(fundId);
  return rows.map(mapReport);
}

export async function previewHtml(investorId: string, runId: string) {
  const row = await navReportEmailModel.getPreviewRow(investorId, runId);
  if (!row) throw new ApiError("Report not found", 404);
  return buildNavReportHtml({
    investorName: row.investor_name,
    fundName: decryptFundField(row.fund_name) ?? "Fund",
    period: row.period,
    closingNav: Number(row.closing_nav),
  });
}

export async function sendOne(investorId: string, runId: string) {
  const row = await navReportEmailModel.getSendRow(investorId, runId);
  if (!row) throw new ApiError("Report not found", 404);

  try {
    const { transport, from } = await getMailer();
    const html = buildNavReportHtml({
      investorName: row.investor_name,
      fundName: decryptFundField(row.fund_name) ?? "Fund",
      period: row.period,
      closingNav: Number(row.closing_nav),
    });
    await transport.sendMail({
      from,
      to: row.email_to,
      subject: `NAV Report — ${row.period}`,
      html,
    });
    await navReportEmailModel.markSent(row.id);
    return { ok: true, status: "sent" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed";
    await navReportEmailModel.markFailed(row.id, msg);
    return { ok: false, status: "failed", error: msg };
  }
}

export async function sendAll(runId: string) {
  const pending = await navReportEmailModel.listPendingForRun(runId);
  const { transport, from } = await getMailer();
  let sent = 0;
  let failed = 0;

  for (const row of pending) {
    try {
      await transport.sendMail({
        from,
        to: row.email_to,
        subject: `NAV Report — ${row.period}`,
        html: buildNavReportHtml({
          investorName: row.investor_name,
          fundName: decryptFundField(row.fund_name) ?? "Fund",
          period: row.period,
          closingNav: Number(row.closing_nav),
        }),
      });
      await navReportEmailModel.markSent(row.id);
      sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Send failed";
      await navReportEmailModel.markFailed(row.id, msg);
      failed++;
    }
  }

  return { sent, failed };
}
