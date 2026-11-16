import { describe, expect, it } from "vitest";
import { formatMoney, toDecimal, toMinor } from "@/lib/money";

describe("toMinor", () => {
  it("converts 2-decimal currencies", () => {
    expect(toMinor("1240.50", "QAR")).toBe(124050n);
    expect(toMinor("0.01", "AED")).toBe(1n);
    expect(toMinor(12, "SAR")).toBe(1200n);
  });

  it("handles 3-decimal currencies", () => {
    expect(toMinor("1.234", "KWD")).toBe(1234n);
    expect(toMinor("0.005", "BHD")).toBe(5n);
  });

  it("handles negatives, grouping and padding", () => {
    expect(toMinor("-7.5", "QAR")).toBe(-750n);
    expect(toMinor("1,240,000", "QAR")).toBe(124000000n);
    expect(toMinor("7.5", "KWD")).toBe(7500n);
  });

  it("rejects too many decimals instead of rounding silently", () => {
    expect(() => toMinor("1.005", "QAR")).toThrow(/Too many decimals/);
  });

  it("rejects non-numeric input and unknown currencies", () => {
    expect(() => toMinor("1.2.3", "QAR")).toThrow(/Invalid amount/);
    expect(() => toMinor("10", "USD")).toThrow(/Unsupported currency/);
  });
});

describe("toDecimal", () => {
  it("round-trips", () => {
    expect(toDecimal(124050n, "QAR")).toBe("1240.50");
    expect(toDecimal(-750n, "QAR")).toBe("-7.50");
    expect(toDecimal(5n, "KWD")).toBe("0.005");
  });
});

describe("formatMoney", () => {
  it("groups thousands and keeps the full precision of the currency", () => {
    expect(formatMoney(124000000n, "QAR")).toBe("QAR 1,240,000.00");
    expect(formatMoney(1234n, "KWD")).toBe("KWD 1.234");
  });
});
