import { describe, expect, it } from "vitest";
import { themePresetSchema } from "./theme";

const validPreset = {
  code: "gulf-default",
  name: "Gulf Default",
  primaryColor: "#795919",
  secondaryColor: "#156c47",
  fontFamily: "Inter, Arial, sans-serif",
  isDefault: false,
};

describe("themePresetSchema", () => {
  it("accepts a valid preset", () => {
    expect(themePresetSchema.safeParse(validPreset).success).toBe(true);
  });

  it("rejects a colour that is not 6-digit hex", () => {
    expect(
      themePresetSchema.safeParse({
        ...validPreset,
        primaryColor: "#79591900; background: red",
      }).success,
    ).toBe(false);
  });

  it("rejects a font containing a CSS delimiter", () => {
    expect(
      themePresetSchema.safeParse({
        ...validPreset,
        fontFamily: "Inter; } body { display:none",
      }).success,
    ).toBe(false);
  });

  it("rejects a code with uppercase or spaces", () => {
    expect(themePresetSchema.safeParse({ ...validPreset, code: "Gulf Default" }).success).toBe(
      false,
    );
  });
});
