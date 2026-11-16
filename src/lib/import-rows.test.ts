import { describe, expect, it } from "vitest";
import { toImportRows } from "./import-rows";

describe("toImportRows", () => {
  it("maps a building row onto the RPC shape", () => {
    const { rows, errors } = toImportRows(
      [{ type: "building", code: "B1", name: "Tower", owner: "Self", city: "Doha", country_code: "QA" }],
      "QAR",
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ row: "2", kind: "building", code: "B1", owner: "Self" });
  });

  it("converts unit rent to minor units and defaults the floor to 0", () => {
    const { rows } = toImportRows(
      [{ type: "unit", code: "B1", unit_no: "101", unit_type: "1br", area_sqm: "55", rent: "4,500.50" }],
      "QAR",
    );
    expect(rows[0]).toMatchObject({
      building: "B1",
      floor: "0",
      unit_no: "101",
      rent_minor: "450050",
    });
  });

  it("honours three-decimal currencies", () => {
    const { rows } = toImportRows([{ type: "unit", code: "B1", unit_no: "1", rent: "120.5" }], "KWD");
    expect(rows[0]?.rent_minor).toBe("120500");
  });

  it("reports bad rent, blank and unknown types without adding rows", () => {
    const { rows, errors } = toImportRows(
      [
        { type: "unit", code: "B1", unit_no: "1", rent: "12.345" },
        { type: "", code: "B2" },
        { type: "floor", code: "B3" },
      ],
      "QAR",
    );
    expect(rows).toEqual([]);
    expect(errors).toEqual([
      { row: "2", message: "invalid rent: 12.345" },
      { row: "3", message: "unknown type: (blank)" },
      { row: "4", message: "unknown type: floor" },
    ]);
  });
});
