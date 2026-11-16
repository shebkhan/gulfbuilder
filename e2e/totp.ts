import { createHmac } from "node:crypto";
import { env } from "./setup";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(secret: string): Buffer {
  const clean = secret.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error(`invalid base32 character: ${char}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * RFC 6238 TOTP, SHA-1, 30 second step — enough to drive the MFA screen in tests.
 * `offsetSeconds` moves the clock to the server's, so a code is never computed for the
 * wrong 30 second window.
 */
export function totp(secret: string, timestampMs = Date.now(), offsetSeconds = 0): string {
  const counter = Math.floor((timestampMs + offsetSeconds * 1000) / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const code =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0x7f) << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;

  return String(code % 1_000_000).padStart(6, "0");
}

/** Difference between the server's clock and this machine's, in seconds. */
export async function serverOffsetSeconds(): Promise<number> {
  const { url, anon } = env();
  const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon } });
  const date = response.headers.get("date");
  if (!date) return 0;
  return Math.round((new Date(date).getTime() - Date.now()) / 1000);
}

/**
 * Codes to try in order. The auth server accepts the current window and the next one, and the
 * two clocks can sit on opposite sides of a window boundary, so one code is not always the
 * one the server wants.
 */
export function totpCandidates(secret: string): string[] {
  const now = Date.now();
  return [totp(secret, now), totp(secret, now + 30_000)];
}
