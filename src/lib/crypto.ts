import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Application-level envelope encryption for ID numbers (SPEC D13).
 * TODO(verify): O2 is open — if the owner chooses Supabase Vault/pgsodium instead,
 * this module is replaced by a database function and the call sites stay the same.
 *
 * Key: 32 bytes, base64, in ID_ENCRYPTION_KEY. Ciphertext: base64(iv || tag || data).
 */
const ALGORITHM = "aes-256-gcm";

function key(): Buffer {
  const raw = process.env.ID_ENCRYPTION_KEY;
  if (!raw) throw new Error("ID_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("ID_ENCRYPTION_KEY must be 32 bytes, base64 encoded");
  return buf;
}

export function encryptId(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function decryptId(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, "base64");
  const decipher = createDecipheriv(ALGORITHM, key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

/** Show only the last 4 characters, for tables and logs (never log the raw value). */
export function maskId(value: string): string {
  return value.length <= 4 ? "••••" : `••••${value.slice(-4)}`;
}
