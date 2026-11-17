import { describe, expect, it } from "vitest";
import { mergeTenantGroups, type PickerTenant } from "./tenant-picker";

describe("mergeTenantGroups", () => {
  it("deduplicates tenants by id across groups and sorts by name", () => {
    const unit: PickerTenant[] = [
      { id: "t2", full_name: "Zayed", phone: null },
      { id: "t1", full_name: "Ahmed", phone: "555" },
    ];
    const room: PickerTenant[] = [
      { id: "t1", full_name: "Ahmed", phone: "555" },
      { id: "t3", full_name: "Mona", phone: null },
    ];

    expect(mergeTenantGroups(unit, room)).toEqual([
      { id: "t1", full_name: "Ahmed", phone: "555" },
      { id: "t3", full_name: "Mona", phone: null },
      { id: "t2", full_name: "Zayed", phone: null },
    ]);
  });

  it("returns an empty list for no input", () => {
    expect(mergeTenantGroups()).toEqual([]);
  });
});
