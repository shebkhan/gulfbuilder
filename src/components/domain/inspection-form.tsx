"use client";

import { CheckCircle2, ClipboardCheck, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LocalizedFormMessage } from "@/components/domain/localized-form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { toFormData } from "@/lib/form-data";
import { completeInspectionSchema, createInspectionSchema } from "@/schemas/inspections";
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

type Checklist = {
  keysHandedOver: boolean;
  wallsAndPaintGood: boolean;
  appliancesWorking: boolean;
  cleanlinessAcceptable: boolean;
  metersRecorded: boolean;
};

const DEFAULT_CHECKLIST: Checklist = {
  keysHandedOver: true,
  wallsAndPaintGood: true,
  appliancesWorking: true,
  cleanlinessAcceptable: true,
  metersRecorded: true,
};

const CHECKLIST_ITEMS: { key: keyof Checklist; label: string }[] = [
  { key: "keysHandedOver", label: "checklist.keys" },
  { key: "wallsAndPaintGood", label: "checklist.walls" },
  { key: "appliancesWorking", label: "checklist.appliances" },
  { key: "metersRecorded", label: "checklist.meters" },
];

type CreateValues = {
  leaseId: string;
  kind: "move_in" | "move_out";
  notes?: string;
};

type CompleteValues = {
  inspectionId: string;
  checklistData: string;
  deductAmount?: string;
  deductReason?: string;
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
  const tCommon = useTranslations("common");
  const errors = t.raw("errors") as Record<string, string>;
  const help = t.raw("help") as Record<string, string>;

  const [openCreate, setOpenCreate] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<InspectionItem | null>(null);
  const [checklist, setChecklist] = useState<Checklist>(DEFAULT_CHECKLIST);

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createInspectionSchema),
    defaultValues: { leaseId: "", kind: "move_in", notes: "" },
  });

  const [createState, createDispatch, createPending] = useActionState<InspectionState, FormData>(
    async (prev, formData) => {
      const res = await createInspectionAction(prev, formData);
      if (res.ok) {
        setOpenCreate(false);
        createForm.reset();
      }
      return res;
    },
    {},
  );

  const completeForm = useForm<CompleteValues>({
    resolver: zodResolver(completeInspectionSchema),
    defaultValues: { inspectionId: "", checklistData: "{}", deductAmount: "", deductReason: "" },
  });

  const [completeState, completeDispatch, completePending] = useActionState<
    InspectionState,
    FormData
  >(async (prev, formData) => {
    const res = await completeInspectionAction(prev, formData);
    if (res.ok) setCompleteTarget(null);
    return res;
  }, {});

  const openComplete = (insp: InspectionItem) => {
    setChecklist(DEFAULT_CHECKLIST);
    completeForm.reset({
      inspectionId: insp.id,
      checklistData: "{}",
      deductAmount: "",
      deductReason: "",
    });
    setCompleteTarget(insp);
  };

  const onCompleteSubmit = completeForm.handleSubmit((values) => {
    const formData = toFormData(values);
    formData.set("checklistData", JSON.stringify(checklist));
    completeDispatch(formData);
  });

  const deductAmount = completeForm.watch("deductAmount");
  const showDeductReason = Number(deductAmount) > 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {writable ? (
          <Button onClick={() => setOpenCreate(true)} className="flex items-center gap-2">
            <Plus className="size-4" />
            {t("newInspection")}
          </Button>
        ) : null}
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
                  <th className="p-4 text-start">{t("lease")}</th>
                  <th className="p-4 text-start">{t("tenant")}</th>
                  <th className="p-4 text-start">{t("status")}</th>
                  <th className="p-4 text-start">{t("completedDate")}</th>
                  <th className="p-4 text-start">{t("notes")}</th>
                  {writable ? <th className="p-4 text-center">{t("actions")}</th> : null}
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
                    <td className="p-4 text-on-surface">{insp.lease?.tenant?.full_name || "—"}</td>
                    <td className="p-4">
                      <Badge variant={insp.completed_at ? "success" : "neutral"}>
                        {insp.completed_at ? t("completedLabel") : t("pending")}
                      </Badge>
                    </td>
                    <td className="p-4 text-on-surface-variant">
                      {insp.completed_at ? new Date(insp.completed_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-4 text-on-surface-variant">{insp.notes || "—"}</td>
                    {writable ? (
                      <td className="p-4 text-center">
                        {!insp.completed_at ? (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => openComplete(insp)}
                            disabled={completePending}
                            className="flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="size-3.5" />
                            {t("complete")}
                          </Button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Inspection Modal */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-[33.6rem]">
          <DialogHeader>
            <DialogTitle>{t("newInspection")}</DialogTitle>
          </DialogHeader>

          <Form {...createForm}>
            <form
              onSubmit={createForm.handleSubmit((values) => createDispatch(toFormData(values)))}
              noValidate
              className="mt-4 flex flex-col gap-4"
            >
              <FormField
                control={createForm.control}
                name="leaseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel description={help.lease}>{t("lease")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectLease")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leases.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.lease_no} — {l.tenant_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel description={help.kind}>{t("kind")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="move_in">{t("moveIn")}</SelectItem>
                        <SelectItem value="move_out">{t("moveOut")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel description={help.notes}>{t("notes")}</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} value={field.value ?? ""} />
                    </FormControl>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />

              {createState.error ? (
                <p
                  role="alert"
                  className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
                >
                  {errors[createState.error] ?? createState.error}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpenCreate(false)}
                  disabled={createPending}
                >
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" disabled={createPending}>
                  {t("newInspection")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Complete Inspection Modal */}
      {completeTarget ? (
        <Dialog
          open
          onOpenChange={(next) => {
            if (!next) setCompleteTarget(null);
          }}
        >
          <DialogContent className="max-w-[38.4rem]">
            <DialogHeader>
              <DialogTitle>
                {t("complete")}: {completeTarget.lease?.lease_no} ({completeTarget.kind})
              </DialogTitle>
            </DialogHeader>

            <Form {...completeForm}>
              <form onSubmit={onCompleteSubmit} noValidate className="mt-4 flex flex-col gap-4">
                <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3">
                  <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                    {t("checklistTitle")}
                  </span>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {help.checklist}
                  </p>
                  {CHECKLIST_ITEMS.map((item) => (
                    <Label
                      key={item.key}
                      htmlFor={`check-${item.key}`}
                      className="mb-0 flex items-center gap-2 font-body-sm normal-case tracking-normal text-on-surface"
                    >
                      <Checkbox
                        id={`check-${item.key}`}
                        checked={checklist[item.key]}
                        onCheckedChange={(checked) =>
                          setChecklist((prev) => ({ ...prev, [item.key]: checked === true }))
                        }
                      />
                      {t(item.label as never)}
                    </Label>
                  ))}
                </div>

                {completeTarget.kind === "move_out" ? (
                  <div className="border-warning/40 bg-warning-container/20 flex flex-col gap-3 rounded-xl border p-3">
                    <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                      {t("deductDeposit")} {t("optional")}
                    </span>
                    <FormField
                      control={completeForm.control}
                      name="deductAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel description={help.deductAmount}>{t("deductAmount")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...field}
                              value={field.value ?? ""}
                              placeholder="0.00"
                              dir="ltr"
                            />
                          </FormControl>
                          <LocalizedFormMessage />
                        </FormItem>
                      )}
                    />

                    {showDeductReason ? (
                      <FormField
                        control={completeForm.control}
                        name="deductReason"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel description={help.deductReason}>
                              {t("deductReason")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value ?? ""}
                                placeholder={t("deductReasonPlaceholder")}
                              />
                            </FormControl>
                            <LocalizedFormMessage />
                          </FormItem>
                        )}
                      />
                    ) : null}
                  </div>
                ) : null}

                {completeState.error ? (
                  <p
                    role="alert"
                    className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
                  >
                    {errors[completeState.error] ?? completeState.error}
                  </p>
                ) : null}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setCompleteTarget(null)}
                    disabled={completePending}
                  >
                    {tCommon("cancel")}
                  </Button>
                  <Button type="submit" disabled={completePending}>
                    {t("complete")}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
