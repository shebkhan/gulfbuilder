"use client";

import { Check, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/money";
import {
  getTenantOutstandingCharges,
  recordPaymentAction,
  type PaymentState,
  type UnallocatedCharge,
} from "@/server/actions/payments";

type TenantOption = {
  id: string;
  name: string;
};

type LeaseOption = {
  id: string;
  lease_no: string;
  tenant_id: string;
};

export function PaymentForm({
  tenants,
  leases,
  locale = "en",
}: {
  tenants: TenantOption[];
  leases: LeaseOption[];
  locale?: string;
}) {
  const t = useTranslations("payments");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<PaymentState>({});

  const [selectedTenant, setSelectedTenant] = useState("");
  const [selectedLease, setSelectedLease] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));

  const [charges, setCharges] = useState<UnallocatedCharge[]>([]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [loadingCharges, setLoadingCharges] = useState(false);

  const handleTenantChange = async (tenantId: string) => {
    setSelectedTenant(tenantId);
    setSelectedLease("");
    setAllocations({});
    if (!tenantId) {
      setCharges([]);
      return;
    }
    setLoadingCharges(true);
    try {
      const outstanding = await getTenantOutstandingCharges(tenantId);
      setCharges(outstanding);
    } catch {
      setCharges([]);
    } finally {
      setLoadingCharges(false);
    }
  };

  const handleAllocationChange = (chargeId: string, val: string) => {
    setAllocations((prev) => ({ ...prev, [chargeId]: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setState({});

    const formData = new FormData();
    formData.set("tenantId", selectedTenant);
    if (selectedLease) formData.set("leaseId", selectedLease);
    formData.set("amount", amount);
    formData.set("method", method);
    formData.set("receivedAt", receivedAt);
    if (reference) formData.set("reference", reference);
    if (notes) formData.set("notes", notes);

    // Format allocations
    const allocArr: { charge_id: string; amount: string }[] = [];
    for (const [cid, val] of Object.entries(allocations)) {
      if (val && parseFloat(val) > 0) {
        allocArr.push({ charge_id: cid, amount: val });
      }
    }
    if (allocArr.length > 0) {
      formData.set("allocations", JSON.stringify(allocArr));
    }

    startTransition(async () => {
      const res = await recordPaymentAction({}, formData);
      setState(res);
      if (res.ok) {
        setOpen(false);
        setAmount("");
        setReference("");
        setNotes("");
        setAllocations({});
        setSelectedTenant("");
      }
    });
  };

  const filteredLeases = selectedTenant
    ? leases.filter((l) => l.tenant_id === selectedTenant)
    : leases;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="size-4" />
          {t("recordPayment")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("recordPayment")}</DialogTitle>
          </DialogHeader>

          {state.error && (
            <div className="mt-4 rounded-xl bg-error-container p-3 font-body-sm text-body-sm text-on-error-container">
              {state.error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                {t("tenant")} *
              </label>
              <select
                required
                value={selectedTenant}
                onChange={(e) => handleTenantChange(e.target.value)}
                className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">{t("selectTenant")}</option>
                {tenants.map((ten) => (
                  <option key={ten.id} value={ten.id}>
                    {ten.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedTenant && (
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("lease")}
                </label>
                <select
                  value={selectedLease}
                  onChange={(e) => setSelectedLease(e.target.value)}
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">{t("selectLease")}</option>
                  {filteredLeases.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lease_no}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("amount")} (QAR) *
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("method")} *
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="cash">{t("methods.cash")}</option>
                  <option value="bank_transfer">{t("methods.bank_transfer")}</option>
                  <option value="cheque">{t("methods.cheque")}</option>
                  <option value="card">{t("methods.card")}</option>
                  <option value="online">{t("methods.online")}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("date")} *
                </label>
                <input
                  required
                  type="date"
                  value={receivedAt}
                  onChange={(e) => setReceivedAt(e.target.value)}
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("reference")}
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="TRX-12345 or CHQ-001"
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {selectedTenant && (
              <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-container-low p-3">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("allocations")}
                </label>
                {loadingCharges ? (
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Loading…</p>
                ) : charges.length === 0 ? (
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {t("noOutstandingCharges")}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      {t("outstandingCharges")}
                    </p>
                    {charges.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 border-b border-hairline/50 pb-2 text-xs"
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-on-surface">
                            {c.type} {c.lease_no ? `(${c.lease_no})` : ""} - Due: {c.due_date}
                          </span>
                          <span className="text-on-surface-variant">
                            Remaining: {formatMoney(BigInt(c.remaining_minor), c.currency, locale)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            max={(c.remaining_minor / 100).toFixed(2)}
                            value={allocations[c.id] || ""}
                            onChange={(e) => handleAllocationChange(c.id, e.target.value)}
                            placeholder="0.00"
                            className="w-24 rounded-lg border border-hairline bg-surface-container-lowest px-2 py-1 text-end"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                {t("notes")}
              </label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="flex items-center gap-2">
                <Check className="size-4" />
                {isPending ? t("recording") : t("recordPayment")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
  );
}
