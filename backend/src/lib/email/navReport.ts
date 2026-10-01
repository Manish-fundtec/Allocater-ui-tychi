import nodemailer from "nodemailer";
import { getEnv } from "../../config/env";
import * as settingsModel from "../../models/settings.model";

export function buildNavReportHtml(params: {
  investorName: string;
  fundName: string;
  period: string;
  closingNav: number;
}): string {
  return `<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;padding:24px">
    <h2>NAV Report — ${params.fundName}</h2>
    <p>Dear ${params.investorName},</p>
    <p>Your closing NAV for <strong>${params.period}</strong> is <strong>₹${params.closingNav.toLocaleString("en-IN")}</strong>.</p>
    <p>— FundTec / Tychi Allocator</p>
  </body></html>`;
}

export async function getMailer() {
  const env = getEnv();
  const host =
    (await settingsModel.getSetting("SMTP_HOST")) ?? env.SMTP_HOST;
  const from =
    (await settingsModel.getSetting("EMAIL_FROM")) ?? env.EMAIL_FROM;
  const apiKey =
    (await settingsModel.getSetting("SENDGRID_API_KEY")) ??
    env.SENDGRID_API_KEY;

  if (apiKey) {
    return {
      from,
      transport: nodemailer.createTransport({
        host: "smtp.sendgrid.net",
        port: 587,
        auth: { user: "apikey", pass: apiKey },
      }),
    };
  }

  if (!host) throw new Error("Email is not configured");

  const smtpPassword =
    (await settingsModel.getSetting("SMTP_PASSWORD")) ?? env.SMTP_PASSWORD;

  return {
    from,
    transport: nodemailer.createTransport({
      host,
      port: env.SMTP_PORT,
      secure: false,
      auth: {
        user: env.SMTP_USER,
        pass: smtpPassword,
      },
    }),
  };
}
