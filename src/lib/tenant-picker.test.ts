import { describe, expect, it } from "vitest";
import { mergeTenantGroups, type PickerTenant } from "./tenant-picker";

describe("mergeTenantGroups", () => {
  it("deduplicates tenants by id across groups and sorts by name", () => {
    const unit: PickerTenant[] = [
      { id: "t2", full_name: "Zayed", id_number: null, nationality: null },
      { id: "t1", full_name: "Ahmed", id_number: "123", nationality: "QA" },
    ];
    const room: PickerTenant[] = [
      { id: "t1", full_name: "Ahmed", id_number: "123", nationality: "QA" },
      { id: "t3", full_name: "Mona", id_number: null, nationality: "EG" },
    ];

    expect(mergeTenantGroups(unit, room)).toEqual([
      { id: "t1", full_name: "Ahmed", id_number: "123", nationality: "QA" },
      { id: "t3", full_name: "Mona", id_number: null, nationality: "EG" },
      { id: "t2", full_name: "Zayed", id_number: null, nationality: null },
    ]);
  });

  it("returns an empty list for no input", () => {
    expect(mergeTenantGroups()).toEqual([]);
  });
});
