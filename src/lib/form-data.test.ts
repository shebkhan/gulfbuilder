import { describe, expect, it } from "vitest";
import { toFormData } from "./form-data";

describe("toFormData", () => {
  it("stringifies flat values, keeps false and File, and skips nullish values", () => {
    const file = new File(["x"], "a.txt");
    const fd = toFormData({
      isSublet: false,
      rent: 10000,
      deposit: null,
      name: undefined,
      proof: file,
    });

    expect(fd.get("isSublet")).toBe("false");
    expect(fd.get("rent")).toBe("10000");
    expect(fd.has("deposit")).toBe(false);
    expect(fd.has("name")).toBe(false);
    expect(fd.get("proof")).toBe(file);
  });
});
