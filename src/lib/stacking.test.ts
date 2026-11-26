import { describe, expect, it } from "vitest";
import {
  assignLayoutOrder,
  groupUnitsByFloor,
  moveUnitBetweenFloors,
  reorderWithinFloor,
  sortUnitsForStacking,
} from "./stacking";

type U = { id: string; unit_no: string; floor_id: string; layout_order: number | null };

describe("stacking helpers", () => {
  const units: U[] = [
    { id: "a", unit_no: "101", floor_id: "f1", layout_order: 2 },
    { id: "b", unit_no: "102", floor_id: "f1", layout_order: null },
    { id: "c", unit_no: "103", floor_id: "f1", layout_order: 1 },
    { id: "d", unit_no: "201", floor_id: "f2", layout_order: null },
  ];

  it("sorts by layout_order then unit_no", () => {
    const sorted = sortUnitsForStacking(units.filter((u) => u.floor_id === "f1"));
    expect(sorted.map((u) => u.id)).toEqual(["c", "a", "b"]);
  });

  it("groups by floor top-down and sorts units", () => {
    const floors = [
      { id: "f1", level: 1, label: "1" },
      { id: "f2", level: 2, label: "2" },
    ];
    const groups = groupUnitsByFloor(units, floors);
    expect(groups.map((g) => g.floor.level)).toEqual([2, 1]);
    expect(groups[1]!.units.map((u) => u.id)).toEqual(["c", "a", "b"]);
  });

  it("reorders within floor without mutating input", () => {
    const list = units.filter((u) => u.floor_id === "f1");
    const original = list.map((u) => u.id);
    const reordered = reorderWithinFloor(list, "b", 0);
    expect(reordered.map((u) => u.id)).toEqual(["b", "a", "c"]);
    expect(list.map((u) => u.id)).toEqual(original);
  });

  it("moves unit between floors", () => {
    const from = units.filter((u) => u.floor_id === "f1");
    const to = units.filter((u) => u.floor_id === "f2");
    const res = moveUnitBetweenFloors(from, to, "a");
    expect(res.moved?.id).toBe("a");
    expect(res.from.map((u) => u.id)).not.toContain("a");
    expect(res.to.map((u) => u.id)).toContain("a");
  });

  it("assigns sequential layout_order", () => {
    const out = assignLayoutOrder(units.filter((u) => u.floor_id === "f1"));
    expect(out.map((u) => u.layout_order)).toEqual([1, 2, 3]);
  });
});
