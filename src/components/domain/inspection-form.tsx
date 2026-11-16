"use client";

import { CheckCircle2, ClipboardCheck, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  completeInspectionAction,
  createInspectionAction,
  type InspectionState,
} from "@/server/actions/inspections";

export type InspectionItem = {
  id: string;
  kind: "move_in" | "move_out";
  data: Record<string, unknown>;
  completed_at: string | null;
  tenant_signed: boolean;
  notes: string | null;
  created_at: string;
  lease: {
    id: string;
    lease_no: string;
    tenant: { id: string; full_name: string } | null;
  } | null;
};

type LeaseOption = {
  id: string;
  lease_no: string;
  tenant_name: string;
};

export function InspectionForm({
  inspections,
  leases,
  writable = false,
}: {
  inspections: InspectionItem[];
  leases: LeaseOption[];
  writable?: boolean;
}) {
  const t = useTranslations("inspections");
  const [openCreate, setOpenCreate] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<InspectionItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<InspectionState>({});

  // Create form state
  const [leaseId, setLeaseId] = useState("");
  const [kind, setKind] = useState<"move_in" | "move_out">("move_in");
  const [notes, setNotes] = useState("");

  // Complete form state
  const [checklist, setChecklist] = useState({
    keysHandedOver: true,
    wallsAndPaintGood: true,
    appliancesWorking: true,
    cleanlinessAcceptable: true,
    metersRecorded: true,
  });
  const [deductAmount, setDeductAmount] = useState("");
  const [deductReason, setDeductReason] = useState("");

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setState({});

    const formData = new FormData();
    formData.set("leaseId", leaseId);
    formData.set("kind", kind);
    if (notes) formData.set("notes", notes);

    startTransition(async () => {
      const res = await createInspectionAction({}, formData);
      setState(res);
      if (res.ok) {
        setOpenCreate(false);
        setLeaseId("");
        setNotes("");
      }
    });
  };

  const handleCompleteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeTarget) return;
    setState({});

    const formData = new FormData();
    formData.set("inspectionId", completeTarget.id);
    formData.set("checklistData", JSON.stringify(checklist));
    if (deductAmount) formData.set("deductAmount", deductAmount);
    if (deductReason) formData.set("deductReason", deductReason);

    startTransition(async () => {
      const res = await completeInspectionAction({}, formData);
      setState(res);
      if (res.ok) {
        setCompleteTarget(null);
        setDeductAmount("");
        setDeductReason("");
      }
    });
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
            {t("newInspection")}
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-hairline bg-surface-container-lowest shadow-card">
        {inspections.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <ClipboardCheck className="size-12 text-on-surface-variant/40" />
            <p className="font-body-md text-body-md text-on-surface-variant">{t("empty")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-start font-body-sm text-body-sm">
              <thead>
                <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                  <th className="p-4 text-start">{t("kind")}</th>
                  <th className="p-4 text-start">Lease</th>
                  <th className="p-4 text-start">Tenant</th>
                  <th className="p-4 text-start">Status</th>
                  <th className="p-4 text-start">Completed Date</th>
                  <th className="p-4 text-start">Notes</th>
                  {writable && <th className="p-4 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {inspections.map((insp) => (
                  <tr key={insp.id} className="transition-colors hover:bg-surface-container-low/50">
                    <td className="p-4">
                      <Badge variant={insp.kind === "move_in" ? "info" : "warning"}>
                        {insp.kind === "move_in" ? t("moveIn") : t("moveOut")}
                      </Badge>
                    </td>
                    <td className="p-4 font-mono font-medium text-on-surface">
                      {insp.lease ? (
                        <Link
                          href={`/leases/${insp.lease.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {insp.lease.lease_no}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-4 text-on-surface">
                      {insp.lease?.tenant?.full_name || "—"}
                    </td>
                    <td className="p-4">
                      <Badge variant={insp.completed_at ? "success" : "neutral"}>
                        {insp.completed_at ? "Completed" : "Pending survey"}
                      </Badge>
                    </td>
                    <td className="p-4 text-on-surface-variant">
                      {insp.completed_at
                        ? new Date(insp.completed_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="p-4 text-on-surface-variant">{insp.notes || "—"}</td>
                    {writable && (
                      <td className="p-4 text-center">
                        {!insp.completed_at && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setCompleteTarget(insp)}
                            disabled={isPending}
                            className="flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="size-3.5" />
                            {t("complete")}
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Inspection Modal */}
      {openCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                {t("newInspection")}
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
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  Lease *
                </label>
                <select
                  required
                  value={leaseId}
                  onChange={(e) => setLeaseId(e.target.value)}
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                >
                  <option value="">Select lease</option>
                  {leases.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lease_no} — {l.tenant_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("kind")} *
                </label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as never)}
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                >
                  <option value="move_in">{t("moveIn")}</option>
                  <option value="move_out">{t("moveOut")}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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
                  {t("newInspection")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Inspection Modal */}
      {completeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              {t("complete")}: {completeTarget.lease?.lease_no} ({completeTarget.kind})
            </h2>

            <form onSubmit={handleCompleteSubmit} className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3">
                <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                  Survey Checklist
                </span>
                <label className="flex items-center gap-2 text-sm text-on-surface">
                  <input
                    type="checkbox"
                    checked={checklist.keysHandedOver}
                    onChange={(e) =>
                      setChecklist({ ...checklist, keysHandedOver: e.target.checked })
                    }
                  />
                  All keys and access cards handed over
                </label>
                <label className="flex items-center gap-2 text-sm text-on-surface">
                  <input
                    type="checkbox"
                    checked={checklist.wallsAndPaintGood}
                    onChange={(e) =>
                      setChecklist({ ...checklist, wallsAndPaintGood: e.target.checked })
                    }
                  />
                  Walls, paint, and fixtures in acceptable condition
                </label>
                <label className="flex items-center gap-2 text-sm text-on-surface">
                  <input
                    type="checkbox"
                    checked={checklist.appliancesWorking}
                    onChange={(e) =>
                      setChecklist({ ...checklist, appliancesWorking: e.target.checked })
                    }
                  />
                  Appliances and AC units tested and working
                </label>
                <label className="flex items-center gap-2 text-sm text-on-surface">
                  <input
                    type="checkbox"
                    checked={checklist.metersRecorded}
                    onChange={(e) =>
                      setChecklist({ ...checklist, metersRecorded: e.target.checked })
                    }
                  />
                  Final utility meter readings logged
                </label>
              </div>

              {completeTarget.kind === "move_out" && (
                <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-container/20 p-3">
                  <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                    {t("deductDeposit")} (Optional)
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">
                      {t("deductAmount")}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={deductAmount}
                      onChange={(e) => setDeductAmount(e.target.value)}
                      placeholder="0.00"
                      className="rounded-xl border border-hairline bg-surface-container-lowest px-3 py-2 font-body-md text-body-md text-on-surface"
                    />
                  </div>

                  {deductAmount && parseFloat(deductAmount) > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <label className="font-label-sm text-label-sm text-on-surface-variant">
                        {t("deductReason")} *
                      </label>
                      <input
                        required
                        type="text"
                        value={deductReason}
                        onChange={(e) => setDeductReason(e.target.value)}
                        placeholder="Broken kitchen cabinet door / Repaint needed"
                        className="rounded-xl border border-hairline bg-surface-container-lowest px-3 py-2 font-body-md text-body-md text-on-surface"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCompleteTarget(null)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {t("complete")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
