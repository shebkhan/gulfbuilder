import { describe, expect, it } from "vitest";
import { can, isRole } from "@/lib/rbac";

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
