import { describe, expect, it } from "vitest";
import { formatHijri } from "./hijri";

describe("formatHijri", () => {
  it("returns a non-empty string for a valid date", () => {
    const out = formatHijri("2026-11-18");
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });

  it("uses Arabic locale when requested", () => {
    const ar = formatHijri("2026-11-18", "ar");
    const en = formatHijri("2026-11-18", "en");
    expect(ar).not.toBe(en);
  });
});