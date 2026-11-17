import { describe, expect, it } from "vitest";
import { visibleNav } from "@/components/domain/nav-items";

const showsToday = (role: Parameters<typeof visibleNav>[0]) =>
  visibleNav(role).some((item) => item.href === "/today");

describe("nav-items", () => {
  it("shows /today to managers and caretakers", () => {
    expect(showsToday("manager")).toBe(true);
    expect(showsToday("caretaker")).toBe(true);
  });

  it("hides /today from every other role", () => {
    for (const role of ["org_admin", "accountant", "owner", "tenant", "platform_admin"] as const) {
      expect(showsToday(role), role).toBe(false);
    }
  });
});
