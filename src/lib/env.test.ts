import { beforeAll, describe, expect, it, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

let mod: typeof import("./env");

beforeAll(async () => {
  mod = await import("./env");
});

describe("env", () => {
  it("exposes the public vars", () => {
    expect(mod.supabaseUrl).toBe("https://example.supabase.co");
    expect(mod.supabaseAnonKey).toBe("anon-key");
  });

  it("serviceRoleKey throws when missing", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(() => mod.serviceRoleKey()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});