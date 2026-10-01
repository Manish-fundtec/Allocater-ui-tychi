import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  if (key.length === 64) {
    return Buffer.from(key, "hex");
  }
  return crypto.pbkdf2Sync(key, "tychi-salt", 100000, KEY_LENGTH, "sha256");
}

export function decrypt(encryptedBuffer: unknown): string | null {
  if (encryptedBuffer == null) return null;

  try {
    let buffer: Buffer;
    if (Buffer.isBuffer(encryptedBuffer)) {
      buffer = encryptedBuffer;
    } else if (typeof encryptedBuffer === "string") {
      buffer = Buffer.from(encryptedBuffer, "hex");
    } else if (
      typeof encryptedBuffer === "object" &&
      encryptedBuffer !== null &&
      "type" in encryptedBuffer &&
      (encryptedBuffer as { type: string }).type === "Buffer" &&
      "data" in encryptedBuffer
    ) {
      buffer = Buffer.from((encryptedBuffer as { data: number[] }).data);
    } else {
      return null;
    }

    if (buffer.length < IV_LENGTH + TAG_LENGTH) return null;

    const key = getEncryptionKey();
    const iv = buffer.slice(0, IV_LENGTH);
    const tag = buffer.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.slice(IV_LENGTH + TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/** Decrypt BYTEA fund fields; pass through plaintext strings. */
export function decryptFundField(value: unknown): string | null {
  if (Buffer.isBuffer(value)) {
    return decrypt(value);
  }
  if (
    value &&
    typeof value === "object" &&
    "type" in value &&
    (value as { type: string }).type === "Buffer" &&
    "data" in value
  ) {
    return decrypt(Buffer.from((value as { data: number[] }).data));
  }
  return typeof value === "string" ? value : null;
}
