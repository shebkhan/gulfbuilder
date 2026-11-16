import { describe, expect, it } from "vitest";
import { maskId } from "./mask";

describe("maskId", () => {
  it("shows only the last four characters", () => {
    expect(maskId("28863451234")).toBe("••••1234");
  });

  it("hides values too short to leave four behind", () => {
    expect(maskId("12")).toBe("••••");
  });
});
