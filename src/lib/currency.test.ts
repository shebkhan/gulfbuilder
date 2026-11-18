import { describe, expect, it } from "vitest";
import { resolveCurrency } from "@/lib/currency";

describe("resolveCurrency", () => {
  it("keeps a supported three-decimal organization currency", () => {
    expect(resolveCurrency("KWD")).toBe("KWD");
  });

  it("falls back to QAR when the organization has no usable currency", () => {
    expect(resolveCurrency(null)).toBe("QAR");
    expect(resolveCurrency("USD")).toBe("QAR");
  });
});
