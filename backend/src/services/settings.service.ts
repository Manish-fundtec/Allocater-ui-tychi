import { maskSetting } from "../lib/crypto/settings";
import { getMailer } from "../lib/email/navReport";
import * as settingsModel from "../models/settings.model";

const KEYS = [
  "EMAIL_FROM",
  "SMTP_HOST",
  "SENDGRID_API_KEY",
  "TYCHI_API_KEY",
  "TYCHI_API_BASE_URL",
] as const;

export async function getSettings() {
  const settings: Record<string, string> = {};
  for (const key of KEYS) {
    const val = await settingsModel.getSetting(key);
    if (val) settings[key] = maskSetting(val);
  }
  return { settings };
}

export async function saveSettings(
  section: "email" | "tychi",
  values: Record<string, string>,
) {
  void section;
  for (const [key, value] of Object.entries(values)) {
    if (value) await settingsModel.upsertSetting(key, value);
  }
  return { ok: true };
}

export async function testEmail(to: string) {
  const { transport, from } = await getMailer();
  await transport.sendMail({
    from,
    to,
    subject: "FundTec Allocator — Test Email",
    text: "This is a test email from Tychi Allocator settings.",
  });
  return { ok: true };
}
