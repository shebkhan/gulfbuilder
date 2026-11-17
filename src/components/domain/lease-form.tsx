"use client";

import { useActionState, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LocalizedFormMessage } from "@/components/domain/localized-form-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { planLeaseCharges, type PlannedCharge } from "@/lib/lease-schedule";
import { formatMoney, toMinor } from "@/lib/money";
import { toFormData } from "@/lib/form-data";
import { createLeaseSchema } from "@/schemas/leases";
import { createLeaseAction, type LeaseState } from "@/server/actions/leases";

type LeaseFormValues = {
  unitId?: string;
  roomId?: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  rent: string;
  currency: string;
  frequency: "monthly" | "quarterly" | "semiannual" | "annual";
  installments: number;
  dueDay: number;
  deposit?: string;
  noticeDays: number;
  isSublet: boolean;
  parentLeaseId?: string;
  leaseNo?: string;
};

type UnitOption = {
  id: string;
  unit_no: string;
  building_name: string;
  default_rent_minor: number | null;
};

type RoomOption = {
  id: string;
  room_number: string;
  unit_no: string;
  building_name: string;
};

type TenantOption = {
  id: string;
  full_name: string;
  phone: string | null;
};

type ParentLeaseOption = {
  id: string;
  lease_no: string;
  unit_id: string | null;
  tenant_name: string;
};

type Props = {
  units: UnitOption[];
  rooms: RoomOption[];
  tenants: TenantOption[];
  activeParentLeases: ParentLeaseOption[];
  defaultTenantId?: string;
  defaultUnitId?: string;
  labels: {
    leaseNo: string;
    tenant: string;
    selectTenant: string;
    unit: string;
    selectUnit: string;
    room: string;
    autoLeaseNo: string;
    startDate: string;
    endDate: string;
    rent: string;
    currency: string;
    frequency: string;
    frequencies: Record<string, string>;
    installments: string;
    dueDay: string;
    deposit: string;
    noticeDays: string;
    leaseNoHint: string;
    rentHint: string;
    dueDayHint: string;
    depositHint: string;
    noticeDaysHint: string;
    isSublet: string;
    parentLease: string;
    selectParentLease: string;
    mainTenant: string;
    subletExplanation: string;
    preview: string;
    type: string;
    period: string;
    dueDate: string;
    amount: string;
    create: string;
    creating: string;
    created: string;
    errors: Record<string, string>;
  };
};

export function LeaseForm({
  units,
  rooms,
  tenants,
  activeParentLeases,
  defaultTenantId,
  defaultUnitId,
  labels,
}: Props) {
  const router = useRouter();
  const [targetType, setTargetType] = useState<"unit" | "room">("unit");

  const today = new Date().toISOString().slice(0, 10);
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 1);

  const form = useForm<LeaseFormValues>({
    resolver: zodResolver(createLeaseSchema),
    defaultValues: {
      unitId: defaultUnitId || units[0]?.id || "",
      roomId: "",
      tenantId: defaultTenantId || tenants[0]?.id || "",
      startDate: today,
      endDate: endDate.toISOString().slice(0, 10),
      rent: "10000",
      currency: "QAR",
      frequency: "annual",
      installments: 4,
      dueDay: 1,
      deposit: "0",
      noticeDays: 60,
      isSublet: false,
      parentLeaseId: activeParentLeases[0]?.id || "",
      leaseNo: "",
    },
  });

  const [state, dispatch, pending] = useActionState<LeaseState, FormData>(
    async (prev, formData) => {
      const res = await createLeaseAction(prev, formData);
      if (res.ok && res.leaseId) {
        router.push(`/leases/${res.leaseId}`);
      }
      return res;
    },
    {},
  );

  const values = form.watch();

  // Live schedule preview calculation
  const previewCharges: PlannedCharge[] = useMemo(() => {
    if (
      !values.startDate ||
      !values.endDate ||
      !values.rent ||
      Number(values.rent) <= 0 ||
      values.installments < 1
    ) {
      return [];
    }
    try {
      return planLeaseCharges({
        rentMinor: toMinor(values.rent, values.currency),
        currency: values.currency,
        frequency: values.frequency,
        installments: values.installments,
        startDate: values.startDate,
        endDate: values.endDate,
        dueDay: values.dueDay,
        depositMinor: values.deposit ? toMinor(values.deposit, values.currency) : 0n,
      });
    } catch {
      return [];
    }
  }, [
    values.startDate,
    values.endDate,
    values.rent,
    values.currency,
    values.frequency,
    values.installments,
    values.dueDay,
    values.deposit,
  ]);

  const selectedParent = activeParentLeases.find((l) => l.id === values.parentLeaseId);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => dispatch(toFormData(data)))}
        className="flex flex-col gap-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="tenantId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{labels.tenant}</FormLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={labels.selectTenant} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.full_name} {t.phone ? `(${t.phone})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="leaseNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{labels.leaseNo}</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} placeholder={labels.autoLeaseNo} dir="ltr" maxLength={50} />
                </FormControl>
                <FormDescription>{labels.leaseNoHint}</FormDescription>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <div className="sm:col-span-2 flex items-center gap-4">
            <RadioGroup
              value={targetType}
              onValueChange={(value) => {
                const next = value as "unit" | "room";
                setTargetType(next);
                form.setValue(next === "unit" ? "roomId" : "unitId", "");
              }}
              className="flex flex-wrap items-center gap-4"
            >
              <label className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface">
                <RadioGroupItem value="unit" />
                {labels.unit}
              </label>
              {rooms.length > 0 ? (
                <label className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface">
                  <RadioGroupItem value="room" />
                  {labels.room}
                </label>
              ) : null}
            </RadioGroup>
          </div>

          {targetType === "unit" ? (
            <FormField
              control={form.control}
              name="unitId"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>{labels.unit}</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={labels.selectUnit} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.building_name} · {labels.unit} {u.unit_no}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <LocalizedFormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name="roomId"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>{labels.room}</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={labels.selectUnit} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.building_name} · {labels.unit} {r.unit_no} · {labels.room} {r.room_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <LocalizedFormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{labels.startDate}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} dir="ltr" />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{labels.endDate}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} dir="ltr" />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{labels.rent}</FormLabel>
                <FormControl>
                  <Input type="number" step="any" {...field} dir="ltr" />
                </FormControl>
                <FormDescription>{labels.rentHint}</FormDescription>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{labels.currency}</FormLabel>
                <FormControl>
                  <Input {...field} readOnly dir="ltr" />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="frequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{labels.frequency}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(["monthly", "quarterly", "semiannual", "annual"] as const).map((key) => (
                      <SelectItem key={key} value={key}>
                        {labels.frequencies[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="installments"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{labels.installments}</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={60} {...field} dir="ltr" />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dueDay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{labels.dueDay}</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={28} {...field} dir="ltr" />
                </FormControl>
                <FormDescription>{labels.dueDayHint}</FormDescription>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="deposit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{labels.deposit}</FormLabel>
                <FormControl>
                  <Input type="number" step="any" {...field} value={field.value ?? ""} dir="ltr" />
                </FormControl>
                <FormDescription>{labels.depositHint}</FormDescription>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="noticeDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{labels.noticeDays}</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} dir="ltr" />
                </FormControl>
                <FormDescription>{labels.noticeDaysHint}</FormDescription>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isSublet"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 sm:col-span-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="font-body-sm text-body-sm">{labels.isSublet}</FormLabel>
              </FormItem>
            )}
          />

          {values.isSublet ? (
            <div className="sm:col-span-2 flex flex-col gap-3 rounded-xl border border-hairline bg-surface-container-low p-4">
              <FormField
                control={form.control}
                name="parentLeaseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{labels.parentLease}</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={labels.selectParentLease} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeParentLeases.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.lease_no} ({l.tenant_name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <LocalizedFormMessage />
                  </FormItem>
                )}
              />

              {selectedParent ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {labels.mainTenant}: <strong className="text-on-surface">{selectedParent.tenant_name}</strong>.{" "}
                  {labels.subletExplanation}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {previewCharges.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-container-lowest p-4">
            <h3 className="font-title-sm text-title-sm text-on-surface">{labels.preview}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-start font-body-sm text-body-sm">
                <thead>
                  <tr className="border-b border-hairline text-on-surface-variant">
                    <th className="py-2 pe-3 text-start font-medium">{labels.type}</th>
                    <th className="py-2 pe-3 text-start font-medium">{labels.period}</th>
                    <th className="py-2 pe-3 text-start font-medium">{labels.dueDate}</th>
                    <th className="py-2 text-end font-medium">{labels.amount}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {previewCharges.map((c, i) => (
                    <tr key={i}>
                      <td className="py-2 pe-3 capitalize text-on-surface">{c.type}</td>
                      <td className="py-2 pe-3 text-on-surface-variant">
                        {c.periodStart} → {c.periodEnd}
                      </td>
                      <td className="py-2 pe-3 text-on-surface-variant" dir="ltr">
                        {c.dueDate}
                      </td>
                      <td className="py-2 text-end font-medium text-on-surface">
                        {formatMoney(c.amountMinor, values.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {state.error ? (
          <p
            role="alert"
            className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
          >
            {labels.errors[state.error] ?? state.error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? labels.creating : labels.create}
        </Button>
      </form>
    </Form>
  );
}
