export type TodayKind = "repair" | "cheque" | "confirmation" | "lease";

export type TodayRow = {
  id: string;
  kind: TodayKind;
  href: string;
  primary: string;
  secondary: string;
  badge: string;
  urgency: number;
};

const KIND_ORDER: readonly TodayKind[] = ["repair", "cheque", "confirmation", "lease"];
const MAX_ITEMS = 8;
const PER_KIND = MAX_ITEMS / KIND_ORDER.length;

export function mergeTodayItems(groups: Record<TodayKind, TodayRow[]>): TodayRow[] {
  return KIND_ORDER.flatMap((kind) =>
    [...groups[kind]].sort((a, b) => a.urgency - b.urgency).slice(0, PER_KIND),
  ).slice(0, MAX_ITEMS);
}
