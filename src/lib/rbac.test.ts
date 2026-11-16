import { describe, expect, it } from "vitest";
import { can, isRole } from "@/lib/rbac";
import { decryptId, encryptId, maskId } from "@/lib/crypto";

describe("rbac", () => {
  it("follows the SPEC section 4 capability matrix", () => {
    expect(can("org_admin", "settings.write")).toBe(true);
    expect(can("manager", "settings.write")).toBe(false);
    expect(can("caretaker", "expenses.write")).toBe(true);
    expect(can("caretaker", "leases.write")).toBe(false);
    expect(can("accountant", "ledger.write")).toBe(true);
    expect(can("manager", "ledger.write")).toBe(false);
    expect(can("owner", "reports.read")).toBe(true);
    expect(can("owner", "properties.write")).toBe(false);
    expect(can("tenant", "reports.read")).toBe(false);
    expect(can("platform_admin", "platform.admin")).toBe(true);
    expect(can("org_admin", "platform.admin")).toBe(false);
    expect(can(null, "reports.read")).toBe(false);
  });

  it("narrows unknown role strings", () => {
    expect(isRole("manager")).toBe(true);
    expect(isRole("superuser")).toBe(false);
  });
});

describe("id encryption", () => {
  process.env.ID_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

  it("round-trips and never repeats the ciphertext", () => {
    const encrypted = encryptId("28863451234");
    expect(encrypted).not.toContain("28863451234");
    expect(decryptId(encrypted)).toBe("28863451234");
    expect(encryptId("28863451234")).not.toBe(encrypted);
  });

  it("rejects tampered ciphertext", () => {
    const buffer = Buffer.from(encryptId("28863451234"), "base64");
    buffer[buffer.length - 1] = (buffer[buffer.length - 1] ?? 0) ^ 0xff;
    expect(() => decryptId(buffer.toString("base64"))).toThrow();
  });

  it("masks to the last four characters", () => {
    expect(maskId("28863451234")).toBe("••••1234");
    expect(maskId("12")).toBe("••••");
  });
});
