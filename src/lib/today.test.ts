import { describe, expect, it } from "vitest";
import { mergeTodayItems, type TodayKind, type TodayRow } from "@/lib/today";

const row = (id: string, kind: TodayKind, urgency = 0): TodayRow => ({
  id,
  kind,
  href: `/${id}`,
  primary: id,
  secondary: "",
  badge: "",
  urgency,
});

const empty = (): Record<TodayKind, TodayRow[]> => ({
  repair: [],
  cheque: [],
  confirmation: [],
  lease: [],
});

describe("mergeTodayItems", () => {
  it("orders categories repair, cheque, confirmation, lease regardless of input order", () => {
    const groups = empty();
    groups.lease = [row("lease", "lease")];
    groups.confirmation = [row("confirmation", "confirmation")];
    groups.cheque = [row("cheque", "cheque")];
    groups.repair = [row("repair", "repair")];

    expect(mergeTodayItems(groups).map((r) => r.kind)).toEqual([
      "repair",
      "cheque",
      "confirmation",
      "lease",
    ]);
  });

  it("orders rows within a kind by ascending urgency", () => {
    const groups = empty();
    groups.cheque = [row("later", "cheque", 0), row("sooner", "cheque", -2)];

    expect(mergeTodayItems(groups).map((r) => r.id)).toEqual(["sooner", "later"]);
  });

  it("caps the result at 8 rows, two per category", () => {
    const groups = empty();
    groups.repair = [1, 2, 3, 4].map((n) => row(`repair-${n}`, "repair"));
    groups.cheque = [1, 2, 3, 4].map((n) => row(`cheque-${n}`, "cheque"));
    groups.confirmation = [1, 2, 3, 4].map((n) => row(`confirmation-${n}`, "confirmation"));
    groups.lease = [1, 2, 3, 4].map((n) => row(`lease-${n}`, "lease"));

    const merged = mergeTodayItems(groups);
    expect(merged).toHaveLength(8);
    expect(merged.map((r) => r.kind)).toEqual([
      "repair",
      "repair",
      "cheque",
      "cheque",
      "confirmation",
      "confirmation",
      "lease",
      "lease",
    ]);
  });

  it("returns an empty array when all groups are empty", () => {
    expect(mergeTodayItems(empty())).toEqual([]);
  });
});
