"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { planLeaseCharges, type PlannedCharge } from "@/lib/lease-schedule";
import { formatMoney, toMinor } from "@/lib/money";
import { createLeaseAction, type LeaseState } from "@/server/actions/leases";

const selectClass =
  "h-11 w-full rounded-xl bg-surface-container-lowest px-3.5 font-body-md text-body-md text-on-surface shadow-sm outline-none transition-shadow focus:bg-surface-container-low focus:ring-[3px] focus:ring-primary-fixed";

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
    isSublet: string;
    parentLease: string;
    selectParentLease: string;
    mainTenant: string;
    preview: string;
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
  const [unitId, setUnitId] = useState(defaultUnitId || units[0]?.id || "");
  const [roomId, setRoomId] = useState(rooms[0]?.id || "");
  const [tenantId, setTenantId] = useState(defaultTenantId || tenants[0]?.id || "");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [rent, setRent] = useState("10000");
  const [currency] = useState("QAR");
  const [frequency, setFrequency] = useState<"monthly" | "quarterly" | "semiannual" | "annual">(
    "annual",
  );
  const [installments, setInstallments] = useState(4);
  const [dueDay, setDueDay] = useState(1);
  const [deposit, setDeposit] = useState("0");
  const [noticeDays, setNoticeDays] = useState(60);
  const [isSublet, setIsSublet] = useState(false);
  const [parentLeaseId, setParentLeaseId] = useState(activeParentLeases[0]?.id || "");

  const [state, formAction, pending] = useActionState<LeaseState, FormData>(
    async (prev, formData) => {
      const res = await createLeaseAction(prev, formData);
      if (res.ok && res.leaseId) {
        router.push(`/leases/${res.leaseId}`);
      }
      return res;
    },
    {},
  );

  // Live schedule preview calculation
  const previewCharges: PlannedCharge[] = useMemo(() => {
    if (!startDate || !endDate || !rent || Number(rent) <= 0 || installments < 1) {
      return [];
    }
    try {
      const rentMinor = toMinor(rent, currency);
      const depositMinor = deposit ? toMinor(deposit, currency) : 0n;
      return planLeaseCharges({
        rentMinor,
        currency,
        frequency,
        installments,
        startDate,
        endDate,
        dueDay,
        depositMinor,
      });
    } catch {
      return [];
    }
  }, [startDate, endDate, rent, currency, frequency, installments, dueDay, deposit]);

  const selectedParent = activeParentLeases.find((l) => l.id === parentLeaseId);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="tenantId">{labels.tenant}</Label>
          <select
            id="tenantId"
            name="tenantId"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className={selectClass}
            required
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name} {t.phone ? `(${t.phone})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="leaseNo">{labels.leaseNo}</Label>
          <Input id="leaseNo" name="leaseNo" placeholder="Auto-generated if empty" dir="ltr" maxLength={50} />
        </div>

        <div className="sm:col-span-2 flex items-center gap-4">
          <label className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface">
            <input
              type="radio"
              name="targetType"
              checked={targetType === "unit"}
              onChange={() => setTargetType("unit")}
            />
            {labels.unit}
          </label>
          {rooms.length > 0 ? (
            <label className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface">
              <input
                type="radio"
                name="targetType"
                checked={targetType === "room"}
                onChange={() => setTargetType("room")}
              />
              Room
            </label>
          ) : null}
        </div>

        {targetType === "unit" ? (
          <div className="sm:col-span-2">
            <Label htmlFor="unitId">{labels.unit}</Label>
            <select
              id="unitId"
              name="unitId"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className={selectClass}
              required
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.building_name} · Unit {u.unit_no}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="sm:col-span-2">
            <Label htmlFor="roomId">Room</Label>
            <select
              id="roomId"
              name="roomId"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className={selectClass}
              required
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.building_name} · Unit {r.unit_no} · Room {r.room_number}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <Label htmlFor="startDate">{labels.startDate}</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="endDate">{labels.endDate}</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="rent">{labels.rent}</Label>
          <Input
            id="rent"
            name="rent"
            type="number"
            step="any"
            required
            dir="ltr"
            value={rent}
            onChange={(e) => setRent(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="currency">{labels.currency}</Label>
          <Input id="currency" name="currency" value={currency} readOnly dir="ltr" />
        </div>

        <div>
          <Label htmlFor="frequency">{labels.frequency}</Label>
          <select
            id="frequency"
            name="frequency"
            value={frequency}
            onChange={(e) =>
              setFrequency(
                e.target.value as "monthly" | "quarterly" | "semiannual" | "annual",
              )
            }
            className={selectClass}
          >
            <option value="monthly">{labels.frequencies.monthly}</option>
            <option value="quarterly">{labels.frequencies.quarterly}</option>
            <option value="semiannual">{labels.frequencies.semiannual}</option>
            <option value="annual">{labels.frequencies.annual}</option>
          </select>
        </div>

        <div>
          <Label htmlFor="installments">{labels.installments}</Label>
          <Input
            id="installments"
            name="installments"
            type="number"
            min={1}
            max={60}
            required
            dir="ltr"
            value={installments}
            onChange={(e) => setInstallments(Number(e.target.value))}
          />
        </div>

        <div>
          <Label htmlFor="dueDay">{labels.dueDay}</Label>
          <Input
            id="dueDay"
            name="dueDay"
            type="number"
            min={1}
            max={28}
            required
            dir="ltr"
            value={dueDay}
            onChange={(e) => setDueDay(Number(e.target.value))}
          />
        </div>

        <div>
          <Label htmlFor="deposit">{labels.deposit}</Label>
          <Input
            id="deposit"
            name="deposit"
            type="number"
            step="any"
            dir="ltr"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="noticeDays">{labels.noticeDays}</Label>
          <Input
            id="noticeDays"
            name="noticeDays"
            type="number"
            min={0}
            dir="ltr"
            value={noticeDays}
            onChange={(e) => setNoticeDays(Number(e.target.value))}
          />
        </div>

        <div className="sm:col-span-2 border-t border-hairline pt-4">
          <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
            <input
              type="checkbox"
              name="isSublet"
              checked={isSublet}
              onChange={(e) => setIsSublet(e.target.checked)}
              className="size-4 rounded accent-primary"
            />
            {labels.isSublet}
          </label>
        </div>

        {isSublet ? (
          <div className="sm:col-span-2 flex flex-col gap-3 rounded-xl border border-hairline bg-surface-container-low p-4">
            <Label htmlFor="parentLeaseId">{labels.parentLease}</Label>
            <select
              id="parentLeaseId"
              name="parentLeaseId"
              value={parentLeaseId}
              onChange={(e) => setParentLeaseId(e.target.value)}
              className={selectClass}
              required={isSublet}
            >
              {activeParentLeases.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.lease_no} ({l.tenant_name})
                </option>
              ))}
            </select>

            {selectedParent ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {labels.mainTenant}: <strong className="text-on-surface">{selectedParent.tenant_name}</strong>.
                Rent will be collected by the main tenant. Sub-let approval by an org admin is required before activation.
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
                  <th className="py-2 pe-3 text-start font-medium">Type</th>
                  <th className="py-2 pe-3 text-start font-medium">Period</th>
                  <th className="py-2 pe-3 text-start font-medium">Due Date</th>
                  <th className="py-2 text-end font-medium">Amount</th>
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
                      {formatMoney(c.amountMinor, currency)}
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
  );
}
