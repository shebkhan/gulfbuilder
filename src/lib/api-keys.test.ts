import { describe, it, expect } from "vitest";
import { hashKey, verifyKey, generateKey } from "./api-keys";

describe("api-keys", () => {
  it("hashes and verifies", () => {
    const k = "gulf_abc123";
    const h = hashKey(k);
    expect(h).not.toBe(k);
    expect(verifyKey(k, h)).toBe(true);
    expect(verifyKey("gulf_wrong", h)).toBe(false);
  });
  it("generates a key with gulf_ prefix and matching hash", () => {
    const { key, hash } = generateKey();
    expect(key.startsWith("gulf_")).toBe(true);
    expect(verifyKey(key, hash)).toBe(true);
  });
});
