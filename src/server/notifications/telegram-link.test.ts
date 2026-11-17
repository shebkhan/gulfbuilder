import { describe, expect, it } from "vitest";
import { parseStartCode } from "./telegram-link";

describe("parseStartCode", () => {
  it("extracts the six-digit code from /start", () => {
    expect(parseStartCode("/start 123456")).toBe("123456");
  });

  it("ignores the bot username suffix", () => {
    expect(parseStartCode("/start 123456@bot")).toBe("123456");
  });

  it("rejects non-start text", () => {
    expect(parseStartCode("hello")).toBeNull();
  });

  it("rejects a bare /start", () => {
    expect(parseStartCode("/start ")).toBeNull();
  });
});
