"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { LottieAnimation } from "@/components/domain/lottie-animation";
import { groupUnitsByFloor } from "@/lib/stacking";
import { bulkSetUnitStatusAction, saveBuildingLayoutAction } from "@/server/actions/property";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Unit = {
  id: string;
  unit_no: string;
  floor_id: string;
  unit_type: string | null;
  area_sqm: number | null;
  default_rent_minor: number | null;
  currency: string | null;
  status: string;
  layout_order: number | null;
};

type Floor = { id: string; level: number; label: string | null };

const STATUS_CHIP: Record<string, string> = {
  vacant: "border-primary-fixed bg-primary-fixed/50 text-on-primary-fixed-variant",
  occupied: "border-secondary-container bg-secondary-container/60 text-on-secondary-container",
  reserved: "border-tertiary-fixed bg-tertiary-fixed/60 text-on-tertiary-container",
  maintenance: "border-error-container bg-error-container text-on-error-container",
};

const STATUSES = ["vacant", "occupied", "reserved", "maintenance"] as const;

export function BuildingSimulator({
  buildingId,
  buildingName,
  currency,
  locale,
  floors,
  units: initialUnits,
  tenantByUnit,
  writable,
}: {
  buildingId: string;
  buildingName: string;
  currency: string;
  locale: string;
  floors: Floor[];
  units: Unit[];
  tenantByUnit: Record<string, string>;
  writable: boolean;
}) {
  const t = useTranslations("buildings");
  const ts = useTranslations("buildings.simulator");
  const [unitMap] = useState<Record<string, Unit>>(() =>
    Object.fromEntries(initialUnits.map((u) => [u.id, u])),
  );
  const initialOrder = useMemo(() => {
    const groups = groupUnitsByFloor(initialUnits, floors);
    const rec: Record<string, string[]> = {};
    for (const g of groups) rec[g.floor.id] = g.units.map((u) => u.id);
    // ensure every floor present
    for (const f of floors) if (!rec[f.id]) rec[f.id] = [];
    return rec;
  }, [initialUnits, floors]);

  const [order, setOrder] = useState<Record<string, string[]>>(initialOrder);
  const [filter, setFilter] = useState<Set<string>>(new Set(STATUSES));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewMode, setPreviewMode] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<Record<string, string>>({});
  const [view, setView] = useState<"grid" | "facade">("grid");
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = useMemo(() => {
    for (const f of floors) {
      const a = initialOrder[f.id] ?? [];
      const b = order[f.id] ?? [];
      if (a.length !== b.length) return true;
      if (a.some((id, i) => id !== b[i])) return true;
    }
    // cross-floor moves change floor_id implicitly via order key; check unit's original floor
    for (const id of initialUnits.map((u) => u.id)) {
      const orig = initialUnits.find((u) => u.id === id)!.floor_id;
      const nowFloor = floors.find((f) => (order[f.id] ?? []).includes(id))?.id;
      if (nowFloor && nowFloor !== orig) return true;
    }
    return false;
  }, [order, initialOrder, floors, initialUnits]);

  const effectiveStatus = (id: string) => previewStatus[id] ?? unitMap[id]?.status ?? "vacant";


  const toggleFilter = (s: string) => {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragEnd = () => setDragId(null);

  const moveUnit = (unitId: string, targetFloorId: string, targetIndex?: number) => {
    if (!writable) return;
    setOrder((prev) => {
      // find source floor
      let sourceFloor: string | null = null;
      for (const f of floors) if ((prev[f.id] ?? []).includes(unitId)) sourceFloor = f.id;
      if (!sourceFloor) return prev;
      if (sourceFloor === targetFloorId) {
        const list = prev[targetFloorId] ?? [];
        const fromIdx = list.indexOf(unitId);
        if (fromIdx === -1) return prev;
        const arr = [...list];
        arr.splice(fromIdx, 1);
        const insertAt = targetIndex == null ? arr.length : Math.max(0, Math.min(targetIndex, arr.length));
        arr.splice(insertAt, 0, unitId);
        return { ...prev, [targetFloorId]: arr };
      }
      // cross-floor
      const srcList = (prev[sourceFloor] ?? []).filter((id) => id !== unitId);
      const tgtList = [...(prev[targetFloorId] ?? [])];
      const insertAt = targetIndex == null ? tgtList.length : Math.max(0, Math.min(targetIndex, tgtList.length));
      tgtList.splice(insertAt, 0, unitId);
      return { ...prev, [sourceFloor]: srcList, [targetFloorId]: tgtList };
    });
  };

  const handleDropOnCell = (targetUnitId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragId || dragId === targetUnitId) return;
    const targetFloor = floors.find((f) => (order[f.id] ?? []).includes(targetUnitId))?.id;
    if (!targetFloor) return;
    const idx = (order[targetFloor] ?? []).indexOf(targetUnitId);
    moveUnit(dragId, targetFloor, idx);
    setDragId(null);
  };

  const handleDropOnFloor = (floorId: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!dragId) return;
    moveUnit(dragId, floorId);
    setDragId(null);
  };

  const saveLayout = () => {
    setSaving(true);
    setMessage(null);
    const layout: { unitId: string; floorId: string; order: number }[] = [];
    for (const f of floors) {
      (order[f.id] ?? []).forEach((id, i) => {
        layout.push({ unitId: id, floorId: f.id, order: i + 1 });
      });
    }
    startTransition(async () => {
      const res = await saveBuildingLayoutAction(buildingId, layout);
      setSaving(false);
      setMessage(res?.ok ? "saved" : res?.error ?? "failed");
    });
  };

  const applyScenario = () => {
    const entries = Object.entries(previewStatus);
    if (entries.length === 0) return;
    // group by target status
    const byStatus: Record<string, string[]> = {};
    for (const [id, st] of entries) {
      (byStatus[st] ??= []).push(id);
    }
    startTransition(async () => {
      for (const [st, ids] of Object.entries(byStatus)) {
        await bulkSetUnitStatusAction(ids, st);
      }
      // update local unitMap
      for (const [id, st] of entries) {
        const prev = unitMap[id];
        if (prev) unitMap[id] = { ...prev, status: st };
      }
      setPreviewStatus({});
      setPreviewMode(false);
      setMessage("updated");
    });
  };

  const discardScenario = () => {
    setPreviewStatus({});
    setPreviewMode(false);
  };

  const cycleStatus = (id: string) => {
    const cur = effectiveStatus(id);
    const idx = STATUSES.indexOf(cur as (typeof STATUSES)[number]);
    const next = STATUSES[(idx + 1) % STATUSES.length];
    setPreviewStatus((p) => ({ ...p, [id]: next as string }));
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkStatus = (status: string) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      await bulkSetUnitStatusAction(ids, status);
      for (const id of ids) {
        const prev = unitMap[id];
        if (prev) unitMap[id] = { ...prev, status };
      }      setSelected(new Set());
      setMessage("updated");
    });
  };

  const formatRent = (u: Unit) => {
    if (u.default_rent_minor == null) return "—";
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: u.currency ?? currency,
      }).format(u.default_rent_minor / 100);
    } catch {
      return String(u.default_rent_minor);
    }
  };

  const renderCell = (id: string) => {
    const u = unitMap[id];
    if (!u) return null;
    const st = effectiveStatus(id);
    const inFilter = filter.has(st);
    const tenant = tenantByUnit[id];
    const isDragging = dragId === id;
    return (
      <Tooltip key={id}>
        <TooltipTrigger asChild>
          <div
            draggable={writable && !previewMode}
            onDragStart={() => handleDragStart(id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDropOnCell(id, e)}
            onClick={() => {
              if (previewMode && writable) cycleStatus(id);
            }}
            className={cn(
              "relative flex h-12 min-w-[4.5rem] flex-col items-center justify-center rounded-md border px-1.5 text-center font-label-sm text-label-sm transition",
              STATUS_CHIP[st] ?? "border-hairline bg-surface-container-low text-on-surface",
              !inFilter && "opacity-30",
              isDragging && "opacity-50",
              previewMode && writable && "cursor-pointer",
              writable && !previewMode && "cursor-grab",
            )}
          >
            {writable && (
              <Checkbox
                checked={selected.has(id)}
                onCheckedChange={() => toggleSelect(id)}
                className="absolute start-1 top-1 size-3"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <span className="font-semibold">{u.unit_no}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{u.unit_no}</span>
            <span>{t(`statuses.${st}`)}</span>
            {u.unit_type ? <span>{u.unit_type}</span> : null}
            {u.area_sqm != null ? <span>{u.area_sqm} m²</span> : null}
            {tenant ? <span>{tenant}</span> : null}
            <span>{formatRent(u)}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  const floorGroups = floors
    .slice()
    .sort((a, b) => b.level - a.level)
    .map((f) => ({ floor: f, ids: order[f.id] ?? [] }));

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-hairline bg-surface-container-low p-1">
            <Button
              size="sm"
              variant={view === "grid" ? "primary" : "ghost"}
              onClick={() => setView("grid")}
            >
              {ts("grid")}
            </Button>
            <Button
              size="sm"
              variant={view === "facade" ? "primary" : "ghost"}
              onClick={() => setView("facade")}
            >
              {ts("facade")}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleFilter(s)}
                className={cn(
                  "rounded-full border px-2.5 py-1 font-label-sm text-label-sm",
                  filter.has(s)
                    ? STATUS_CHIP[s]
                    : "border-hairline bg-surface-container-low text-on-surface-variant opacity-60",
                )}
              >
                {t(`statuses.${s}`)}
              </button>
            ))}
          </div>

          {writable && (
            <>
              <Button
                size="sm"
                variant={previewMode ? "primary" : "secondary"}
                onClick={() => {
                  if (previewMode) discardScenario();
                  else setPreviewMode(true);
                }}
              >
                {previewMode ? ts("exitPreview") : ts("preview")}
              </Button>
              {previewMode && (
                <>
                  <Button size="sm" onClick={applyScenario} disabled={Object.keys(previewStatus).length === 0 || isPending}>
                    {ts("apply")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={discardScenario}>
                    {ts("discard")}
                  </Button>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {ts("previewHint")} {Object.keys(previewStatus).length} {ts("changed")}.
                  </span>
                </>
              )}
            </>
          )}

          {writable && dirty && !previewMode && (
            <Button size="sm" onClick={saveLayout} disabled={saving || isPending}>
              {saving ? (
                <span className="flex items-center gap-1.5">
                  <LottieAnimation src="/animations/loading.lottie" className="h-4 w-4" />
                  {ts("saving")}
                </span>
              ) : (
                ts("saveLayout")
              )}
            </Button>
          )}

          {message && (
            <span className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
              {(message === "saved" || message === "updated") && (
                <LottieAnimation src="/animations/success.lottie" className="h-5 w-5" loop={false} />
              )}
              {message}
            </span>
          )}
        </div>

        {/* Bulk bar */}
        {writable && selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface-container-low px-3 py-2">
            <span className="font-label-sm text-label-sm text-on-surface">
              {selected.size} {ts("selected")}
            </span>
            <Button size="sm" variant="secondary" onClick={() => bulkStatus("maintenance")}>
              {ts("markMaintenance")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => bulkStatus("vacant")}>
              {ts("markVacant")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              {ts("clear")}
            </Button>
          </div>
        )}

        {/* Building */}
        <div
          className={cn(
            "rounded-2xl border border-hairline bg-surface-container-lowest p-4",
            view === "facade" && "overflow-hidden",
          )}
          style={
            view === "facade"
              ? { perspective: "1400px", perspectiveOrigin: "50% 0%" }
              : undefined
          }
        >
          <div
            className="flex flex-col gap-3"
            style={
              view === "facade"
                ? { transform: "rotateX(10deg)", transformOrigin: "top center", transformStyle: "preserve-3d" }
                : undefined
            }
          >
            {floorGroups.map(({ floor, ids }) => (
              <div
                key={floor.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropOnFloor(floor.id, e)}
                className="flex items-center gap-3 rounded-xl border border-hairline bg-surface-container-low/40 p-2"
              >
                <span className="w-12 shrink-0 text-center font-label-sm text-label-sm text-on-surface-variant">
                  {floor.label ?? floor.level}
                </span>
                <div className="flex flex-wrap gap-2">
                  {ids.length === 0 ? (
                    <span className="font-body-sm text-body-sm text-on-surface-variant/60">
                      —
                    </span>
                  ) : (
                    ids.map((id) => renderCell(id))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {buildingName} · {floors.length} {ts("floors")} · {initialUnits.length} {ts("units")}
        </p>
      </div>
    </TooltipProvider>
  );
}