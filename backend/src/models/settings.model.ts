import { query, queryOne } from "../db/pool";
import {
  decryptSetting,
  encryptSetting,
} from "../lib/crypto/settings";

export async function getSetting(key: string): Promise<string | null> {
  const row = await queryOne<{ value_encrypted: string }>(
    `SELECT value_encrypted FROM allocator_settings WHERE key = $1 LIMIT 1`,
    [key],
  );
  if (!row) {
    return process.env[key] ?? null;
  }
  return decryptSetting(row.value_encrypted);
}

export async function upsertSetting(key: string, value: string): Promise<void> {
  const encrypted = encryptSetting(value);
  await query(
    `INSERT INTO allocator_settings (key, value_encrypted, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value_encrypted = EXCLUDED.value_encrypted, updated_at = NOW()`,
    [key, encrypted],
  );
}

export async function listSettingKeys(): Promise<string[]> {
  const rows = await query<{ key: string }>(
    `SELECT key FROM allocator_settings`,
  );
  return rows.map((r) => r.key);
}
