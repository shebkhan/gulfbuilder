import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  addMonthsISO,
  daysBetween,
  isValidISODate,
  monthEnd,
  monthStart,
} from "@/lib/dates";

describe("dates", () => {
  it("validates ISO dates including impossible days", () => {
    expect(isValidISODate("2026-11-16")).toBe(true);
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("16/11/2026")).toBe(false);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("clamps month arithmetic to the target month length", () => {
    expect(addMonthsISO("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsISO("2026-11-16", 12)).toBe("2027-11-16");
    expect(addMonthsISO("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("computes month bounds", () => {
    expect(monthStart("2026-11-16")).toBe("2026-11-01");
    expect(monthEnd("2026-02-10")).toBe("2026-02-28");
    expect(monthEnd("2028-02-10")).toBe("2028-02-29");
  });

  it("counts days", () => {
    expect(daysBetween("2026-11-01", "2026-11-30")).toBe(29);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });
});
