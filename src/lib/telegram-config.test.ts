import { describe, expect, it } from "vitest";
import { hasStoredToken } from "./telegram-config";

describe("hasStoredToken", () => {
  it("is true when config contains a non-empty bot token", () => {
    expect(hasStoredToken({ bot_token: "123:abc" })).toBe(true);
  });

  it("is false for an empty, missing or malformed config", () => {
    expect(hasStoredToken({ bot_token: "" })).toBe(false);
    expect(hasStoredToken({})).toBe(false);
    expect(hasStoredToken(null)).toBe(false);
  });
});
