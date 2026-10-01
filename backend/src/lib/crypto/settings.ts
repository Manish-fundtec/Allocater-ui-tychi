import crypto from "crypto";
import { getEnv } from "../../config/env";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function key(): Buffer {
  return crypto
    .createHash("sha256")
    .update(getEnv().SETTINGS_ENCRYPTION_KEY)
    .digest();
}

export function encryptSetting(plain: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

export function decryptSetting(stored: string): string {
  if (!stored.includes(":")) return stored;
  const [ivB64, tagB64, dataB64] = stored.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

export function maskSetting(value: string): string {
  return value.replace(/.(?=.{4})/g, "*");
}
