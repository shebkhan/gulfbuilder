import { beforeAll, describe, expect, it, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

let mod: typeof import("./white-label");

beforeAll(async () => {
  mod = await import("./white-label");
});

describe("encodeBrand / decodeBrand", () => {
  const brand = {
    orgId: "11111111-1111-1111-1111-111111111111",
    slug: "demo",
    appName: "Demo",
    logoUrl: null,
    faviconUrl: null,
    primaryColor: "#123456",
    secondaryColor: null,
    fontFamily: null,
    terminology: { "nav.leases": "Tenancies" },
    customDomain: null,
  };

  it("round-trips a brand", () => {
    const encoded = mod.encodeBrand(brand as never);
    expect(mod.decodeBrand(encoded)).toEqual(brand);
  });

  it("returns null for empty or invalid input", () => {
    expect(mod.decodeBrand(null)).toBeNull();
    expect(mod.decodeBrand(undefined)).toBeNull();
    expect(mod.decodeBrand("")).toBeNull();
    expect(mod.decodeBrand("not-base64!!!")).toBeNull();
  });
});

describe("applyTerminology", () => {
  it("returns the original messages when terminology is empty", () => {
    const messages = { nav: { leases: "Leases" } };
    expect(mod.applyTerminology(messages, {})).toBe(messages);
    expect(mod.applyTerminology(messages, null)).toBe(messages);
    expect(mod.applyTerminology(messages, undefined)).toBe(messages);
  });

  it("overrides an existing dotted key", () => {
    const messages = { nav: { leases: "Leases" } };
    const out = mod.applyTerminology(messages, { "nav.leases": "Tenancies" });
    expect((out as { nav: { leases: string } }).nav.leases).toBe("Tenancies");
    expect((messages as { nav: { leases: string } }).nav.leases).toBe("Leases");
  });

  it("ignores keys that do not exist", () => {
    const messages = { nav: { leases: "Leases" } };
    const out = mod.applyTerminology(messages, { "nav.nope": "X" });
    expect((out as { nav: { leases: string } }).nav.leases).toBe("Leases");
    expect((out as { nav: Record<string, unknown> }).nav).not.toHaveProperty("nope");
  });
});