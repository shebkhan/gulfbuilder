// Pure helpers for the visual stacking simulator.

export type LayoutUnit = {
  id: string;
  unit_no: string;
  floor_id: string;
  layout_order: number | null;
};

export function sortUnitsForStacking<U extends LayoutUnit>(units: readonly U[]): U[] {
  return [...units].sort((a, b) => {
    if (a.layout_order != null && b.layout_order != null) return a.layout_order - b.layout_order;
    if (a.layout_order != null) return -1;
    if (b.layout_order != null) return 1;
    return a.unit_no.localeCompare(b.unit_no, undefined, { numeric: true });
  });
}

export function groupUnitsByFloor<U extends LayoutUnit, F extends { id: string; level: number; label: string | null }>(
  units: readonly U[],
  floors: readonly F[],
): { floor: F; units: U[] }[] {
  return [...floors]
    .sort((a, b) => b.level - a.level)
    .map((floor) => ({
      floor,
      units: sortUnitsForStacking(units.filter((u) => u.floor_id === floor.id)),
    }));
}

export function reorderWithinFloor<U extends LayoutUnit>(units: readonly U[], unitId: string, toIndex: number): U[] {
  const list = [...units];
  const fromIndex = list.findIndex((u) => u.id === unitId);
  if (fromIndex === -1) return list;
  const moved = list.splice(fromIndex, 1)[0] as U;
  const clamped = Math.max(0, Math.min(toIndex, list.length));
  list.splice(clamped, 0, moved);
  return list;
}

export function moveUnitBetweenFloors<U extends LayoutUnit>(
  fromUnits: readonly U[],
  toUnits: readonly U[],
  unitId: string,
): { from: U[]; to: U[]; moved: U | null } {
  const idx = fromUnits.findIndex((u) => u.id === unitId);
  if (idx === -1) return { from: [...fromUnits], to: [...toUnits], moved: null };
  const moved = fromUnits[idx] as U;
  const from = fromUnits.filter((u) => u.id !== unitId);
  const to = [...toUnits, moved];
  return { from, to, moved };
}

export function assignLayoutOrder<U extends LayoutUnit>(units: readonly U[]): (U & { layout_order: number })[] {
  return units.map((u, i) => ({ ...u, layout_order: i + 1 }));
}
