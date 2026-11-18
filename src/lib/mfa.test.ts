import { describe, expect, it } from "vitest";
import { requiresMfa } from "./mfa";

describe("requiresMfa", () => {
  it("requires MFA for admin roles", () => {
    expect(requiresMfa("org_admin")).toBe(true);
    expect(requiresMfa("platform_admin")).toBe(true);
  });

  it("does not require MFA for non-admin roles", () => {
    for (const role of ["manager", "accountant", "caretaker", "owner", "tenant"] as const) {
      expect(requiresMfa(role)).toBe(false);
    }
  });
});