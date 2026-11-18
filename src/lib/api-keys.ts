import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function verifyKey(key: string, hash: string): boolean {
  const a = Buffer.from(hashKey(key), "utf8");
  const b = Buffer.from(hash, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function generateKey(): { key: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  const key = `gulf_${raw}`;
  return { key, hash: hashKey(key) };
}
