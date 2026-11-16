"use client";

import { Plus, Wrench, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import {
  createMaintenanceRequestAction,
  updateMaintenanceStatusAction,
  type MaintenanceState,
} from "@/server/actions/maintenance";

export type MaintenanceItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting_parts" | "completed" | "cancelled";
  cost_minor: number | null;
  currency: string;
  opened_at: string;
  resolved_at: string | null;
  building: { id: string; name: string; code: string } | null;
  unit: { id: string; unit_no: string } | null;
  tenant: { id: string; full_name: string } | null;
  vendor: { id: string; name: string } | null;
};

type BuildingOption = { id: string; name: string; code: string };
type UnitOption = { id: string; unit_no: string; building_id: string };
type VendorOption = { id: string; name: string };

export function MaintenanceForm({
  requests,
  buildings,
  units,
  vendors,
  writable = false,
  locale = "en",
}: {
  requests: MaintenanceItem[];
  buildings: BuildingOption[];
  units: UnitOption[];
  vendors: VendorOption[];
  writable?: boolean;
  locale?: string;
}) {
  const t = useTranslations("maintenance");
  const [openCreate, setOpenCreate] = useState(false);
  const [statusTarget, setStatusTarget] = useState<MaintenanceItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<MaintenanceState>({});

  // Form state
  const [buildingId, setBuildingId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("plumbing");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [vendorId, setVendorId] = useState("");

  // Update status state
  const [newStatus, setNewStatus] = useState<MaintenanceItem["status"]>("in_progress");
  const [statusNote, setStatusNote] = useState("");
  const [cost, setCost] = useState("");

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setState({});

    const formData = new FormData();
    formData.set("buildingId", buildingId);
    if (unitId) formData.set("unitId", unitId);
    formData.set("title", title);
    if (description) formData.set("description", description);
    formData.set("category", category);
    formData.set("priority", priority);
    if (vendorId) formData.set("vendorId", vendorId);

    startTransition(async () => {
      const res = await createMaintenanceRequestAction({}, formData);
      setState(res);
      if (res.ok) {
        setOpenCreate(false);
        setTitle("");
        setDescription("");
        setBuildingId("");
        setUnitId("");
        setVendorId("");
      }
    });
  };

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusTarget) return;
    setState({});

    const formData = new FormData();
    formData.set("requestId", statusTarget.id);
    formData.set("status", newStatus);
    if (statusNote) formData.set("note", statusNote);
    if (cost) formData.set("cost", cost);

    startTransition(async () => {
      const res = await updateMaintenanceStatusAction({}, formData);
      setState(res);
      if (res.ok) {
        setStatusTarget(null);
        setStatusNote("");
        setCost("");
      }
    });
  };

  const filteredUnits = buildingId
    ? units.filter((u) => u.building_id === buildingId)
    : units;

  const getPriorityBadgeVariant = (p: string) => {
    switch (p) {
      case "urgent":
        return "danger";
      case "high":
        return "warning";
      case "normal":
        return "info";
      default:
        return "neutral";
    }
  };

  const getStatusBadgeVariant = (s: string) => {
    switch (s) {
      case "completed":
        return "success";
      case "in_progress":
        return "info";
      case "waiting_parts":
        return "warning";
      case "cancelled":
        return "neutral";
      default:
        return "neutral";
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {state.error && (
          <div className="w-full rounded-xl bg-error-container p-3 font-body-sm text-body-sm text-on-error-container">
            {state.error}
          </div>
        )}
        <div />
        {writable && (
          <Button onClick={() => setOpenCreate(true)} className="flex items-center gap-2">
            <Plus className="size-4" />
            {t("createRequest")}
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-hairline bg-surface-container-lowest shadow-card">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Wrench className="size-12 text-on-surface-variant/40" />
            <p className="font-body-md text-body-md text-on-surface-variant">{t("empty")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-start font-body-sm text-body-sm">
              <thead>
                <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                  <th className="p-4 text-start">{t("priority")}</th>
                  <th className="p-4 text-start">{t("requestTitle")}</th>
                  <th className="p-4 text-start">{t("property")}</th>
                  <th className="p-4 text-start">{t("unit")}</th>
                  <th className="p-4 text-start">{t("category")}</th>
                  <th className="p-4 text-start">{t("assignedVendor")}</th>
                  <th className="p-4 text-start">{t("status")}</th>
                  <th className="p-4 text-end">{t("cost")}</th>
                  {writable && <th className="p-4 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {requests.map((req) => (
                  <tr key={req.id} className="transition-colors hover:bg-surface-container-low/50">
                    <td className="p-4">
                      <Badge variant={getPriorityBadgeVariant(req.priority)}>
                        {t(`priorities.${req.priority}` as never)}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-on-surface">{req.title}</span>
                        {req.description && (
                          <span className="line-clamp-1 text-xs text-on-surface-variant">
                            {req.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-on-surface">
                      {req.building ? `${req.building.code} - ${req.building.name}` : "—"}
                    </td>
                    <td className="p-4 text-on-surface">{req.unit?.unit_no || "Common"}</td>
                    <td className="p-4 text-on-surface-variant capitalize">{req.category}</td>
                    <td className="p-4 text-on-surface-variant">{req.vendor?.name || "Unassigned"}</td>
                    <td className="p-4">
                      <Badge variant={getStatusBadgeVariant(req.status)}>
                        {t(`statuses.${req.status}` as never)}
                      </Badge>
                    </td>
                    <td className="p-4 text-end font-semibold text-on-surface">
                      {req.cost_minor
                        ? formatMoney(BigInt(req.cost_minor), req.currency, locale)
                        : "—"}
                    </td>
                    {writable && (
                      <td className="p-4 text-center">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setStatusTarget(req);
                            setNewStatus(req.status);
                            setCost(req.cost_minor ? (req.cost_minor / 100).toFixed(2) : "");
                          }}
                          disabled={isPending}
                        >
                          {t("updateStatus")}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Request Modal */}
      {openCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                {t("createRequest")}
              </h2>
              <button
                type="button"
                onClick={() => setOpenCreate(false)}
                className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container-high"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                    {t("property")} *
                  </label>
                  <select
                    required
                    value={buildingId}
                    onChange={(e) => {
                      setBuildingId(e.target.value);
                      setUnitId("");
                    }}
                    className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                  >
                    <option value="">Select building</option>
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                    {t("unit")}
                  </label>
                  <select
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                  >
                    <option value="">Common area</option>
                    {filteredUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        Unit {u.unit_no}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("requestTitle")} *
                </label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Water leakage in master bathroom"
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                    {t("category")} *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                  >
                    <option value="plumbing">Plumbing</option>
                    <option value="electrical">Electrical</option>
                    <option value="hvac">HVAC / Air Conditioning</option>
                    <option value="carpentry">Carpentry</option>
                    <option value="painting">Painting</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                    {t("priority")} *
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as never)}
                    className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                  >
                    <option value="low">{t("priorities.low")}</option>
                    <option value="normal">{t("priorities.normal")}</option>
                    <option value="high">{t("priorities.high")}</option>
                    <option value="urgent">{t("priorities.urgent")}</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("assignedVendor")}
                </label>
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                >
                  <option value="">Unassigned</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("description")}
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpenCreate(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {t("createRequest")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {statusTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              {t("updateStatus")}: {statusTarget.title}
            </h2>
            <form onSubmit={handleStatusSubmit} className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("status")} *
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as never)}
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                >
                  <option value="open">{t("statuses.open")}</option>
                  <option value="in_progress">{t("statuses.in_progress")}</option>
                  <option value="waiting_parts">{t("statuses.waiting_parts")}</option>
                  <option value="completed">{t("statuses.completed")}</option>
                  <option value="cancelled">{t("statuses.cancelled")}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("cost")} (QAR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  Note
                </label>
                <input
                  type="text"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Parts replaced, pressure tested"
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStatusTarget(null)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {t("updateStatus")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
