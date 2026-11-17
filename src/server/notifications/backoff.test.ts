import { describe, expect, it } from "vitest";
import { retryAt } from "./backoff";

describe("retryAt", () => {
  const base = new Date("2026-01-01T00:00:00Z");

  it("backs off 1m, 5m, 25m, then gives up", () => {
    expect(retryAt(1, base)).toEqual(new Date(base.getTime() + 60_000));
    expect(retryAt(2, base)).toEqual(new Date(base.getTime() + 300_000));
    expect(retryAt(3, base)).toEqual(new Date(base.getTime() + 1_500_000));
    expect(retryAt(4, base)).toBeNull();
  });
});
