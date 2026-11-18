import { describe, expect, it } from "vitest";
import { parseForecastInput } from "@/schemas/forecast";

describe("parseForecastInput", () => {
  it("accepts a supported horizon and scenario", () => {
    expect(parseForecastInput({ months: 6, scenario: "conservative" })).toEqual({
      months: 6,
      scenario: "conservative",
    });
  });

  it("rejects an unsupported horizon", () => {
    expect(() => parseForecastInput({ months: 4, scenario: "base" })).toThrow(/months/);
  });
});
