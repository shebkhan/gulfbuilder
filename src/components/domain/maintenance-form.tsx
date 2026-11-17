"use client";

import { Plus, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LocalizedFormMessage } from "@/components/domain/localized-form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toFormData } from "@/lib/form-data";
import { formatMoney } from "@/lib/money";
import { createRequestSchema, updateStatusSchema } from "@/schemas/maintenance";
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

const NONE = "__none__";

const CATEGORY_KEYS = ["plumbing", "electrical", "hvac", "carpentry", "painting", "general"] as const;
const PRIORITY_KEYS = ["low", "normal", "high", "urgent"] as const;
const STATUS_KEYS = ["open", "in_progress", "waiting_parts", "completed", "cancelled"] as const;

type CreateValues = {
  buildingId: string;
  unitId?: string;
  title: string;
  description?: string;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
  vendorId?: string;
};

type StatusValues = {
  requestId: string;
  status: MaintenanceItem["status"];
  cost?: string;
  note?: string;
};

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
  const tCommon = useTranslations("common");
  const errors = t.raw("errors") as Record<string, string>;
  const help = t.raw("help") as Record<string, string>;
  const categories = t.raw("categories") as Record<string, string>;

  const [openCreate, setOpenCreate] = useState(false);
  const [statusTarget, setStatusTarget] = useState<MaintenanceItem | null>(null);

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createRequestSchema),
    defaultValues: {
      buildingId: "",
      unitId: "",
      title: "",
      description: "",
      category: "plumbing",
      priority: "normal",
      vendorId: "",
    },
  });

  const [createState, createDispatch, createPending] = useActionState<MaintenanceState, FormData>(
    async (prev, formData) => {
      const res = await createMaintenanceRequestAction(prev, formData);
      if (res.ok) {
        setOpenCreate(false);
        createForm.reset();
      }
      return res;
    },
    {},
  );

  const statusForm = useForm<StatusValues>({
    resolver: zodResolver(updateStatusSchema),
    defaultValues: { requestId: "", status: "in_progress", cost: "", note: "" },
  });

  const [statusState, statusDispatch, statusPending] = useActionState<MaintenanceState, FormData>(
    async (prev, formData) => {
      const res = await updateMaintenanceStatusAction(prev, formData);
      if (res.ok) setStatusTarget(null);
      return res;
    },
    {},
  );

  const buildingId = createForm.watch("buildingId");
  const filteredUnits = buildingId ? units.filter((u) => u.building_id === buildingId) : units;

  const openStatus = (req: MaintenanceItem) => {
    statusForm.reset({
      requestId: req.id,
      status: req.status,
      cost: req.cost_minor ? (req.cost_minor / 100).toFixed(2) : "",
      note: "",
    });
    setStatusTarget(req);
  };

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
        {writable ? (
          <Button onClick={() => setOpenCreate(true)} className="flex items-center gap-2">
            <Plus className="size-4" />
            {t("createRequest")}
          </Button>
        ) : null}
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
                  {writable ? <th className="p-4 text-center">{t("actions")}</th> : null}
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
                    <td className="p-4 text-on-surface">{req.unit?.unit_no || t("commonArea")}</td>
                    <td className="p-4 text-on-surface-variant">
                      {categories[req.category] ?? req.category}
                    </td>
                    <td className="p-4 text-on-surface-variant">
                      {req.vendor?.name || t("unassigned")}
                    </td>
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
                    {writable ? (
                      <td className="p-4 text-center">
                        <Button size="sm" variant="secondary" onClick={() => openStatus(req)}>
                          {t("updateStatus")}
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Request Modal */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-[38.4rem]">
          <DialogHeader>
            <DialogTitle>{t("createRequest")}</DialogTitle>
          </DialogHeader>

          <Form {...createForm}>
            <form
              onSubmit={createForm.handleSubmit((values) => createDispatch(toFormData(values)))}
              noValidate
              className="mt-4 flex flex-col gap-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="buildingId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("property")}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          createForm.setValue("unitId", "");
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("selectBuilding")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {buildings.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.code} - {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>{help.building}</FormDescription>
                      <LocalizedFormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="unitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("unit")}</FormLabel>
                      <Select
                        value={field.value === "" ? NONE : field.value}
                        onValueChange={(value) => field.onChange(value === NONE ? "" : value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE}>{t("commonArea")}</SelectItem>
                          {filteredUnits.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {t("unitOption", { no: u.unit_no })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>{help.unit}</FormDescription>
                      <LocalizedFormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("requestTitle")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("titlePlaceholder")} />
                    </FormControl>
                    <FormDescription>{help.title}</FormDescription>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("category")}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORY_KEYS.map((key) => (
                            <SelectItem key={key} value={key}>
                              {categories[key]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>{help.category}</FormDescription>
                      <LocalizedFormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("priority")}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRIORITY_KEYS.map((key) => (
                            <SelectItem key={key} value={key}>
                              {t(`priorities.${key}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>{help.priority}</FormDescription>
                      <LocalizedFormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createForm.control}
                name="vendorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("assignedVendor")}</FormLabel>
                    <Select
                      value={field.value === "" ? NONE : field.value}
                      onValueChange={(value) => field.onChange(value === NONE ? "" : value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>{t("unassigned")}</SelectItem>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>{help.vendor}</FormDescription>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("description")}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormDescription>{help.description}</FormDescription>
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
                  {t("createRequest")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Update Status Modal */}
      {statusTarget ? (
        <Dialog
          open
          onOpenChange={(next) => {
            if (!next) setStatusTarget(null);
          }}
        >
          <DialogContent className="max-w-[33.6rem]">
            <DialogHeader>
              <DialogTitle>
                {t("updateStatus")}: {statusTarget.title}
              </DialogTitle>
            </DialogHeader>
            <Form {...statusForm}>
              <form
                onSubmit={statusForm.handleSubmit((values) => statusDispatch(toFormData(values)))}
                noValidate
                className="mt-4 flex flex-col gap-4"
              >
                <FormField
                  control={statusForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("status")}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUS_KEYS.map((key) => (
                            <SelectItem key={key} value={key}>
                              {t(`statuses.${key}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>{help.status}</FormDescription>
                      <LocalizedFormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={statusForm.control}
                  name="cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("cost")} ({tCommon("currency")})</FormLabel>
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
                      <FormDescription>{help.cost}</FormDescription>
                      <LocalizedFormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={statusForm.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("note")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder={t("notePlaceholder")}
                        />
                      </FormControl>
                      <FormDescription>{help.note}</FormDescription>
                      <LocalizedFormMessage />
                    </FormItem>
                  )}
                />

                {statusState.error ? (
                  <p
                    role="alert"
                    className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
                  >
                    {errors[statusState.error] ?? statusState.error}
                  </p>
                ) : null}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setStatusTarget(null)}
                    disabled={statusPending}
                  >
                    {tCommon("cancel")}
                  </Button>
                  <Button type="submit" disabled={statusPending}>
                    {t("updateStatus")}
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
