"use client";

import { ArrowRightLeft, Landmark, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import {
  bounceChequeAction,
  clearChequeAction,
  depositChequeAction,
  registerChequeAction,
  replaceChequeAction,
  type ChequeState,
} from "@/server/actions/cheques";

export type ChequeItem = {
  id: string;
  cheque_no: string;
  bank_name: string | null;
  amount_minor: number;
  currency: string;
  cheque_date: string;
  status: "received" | "deposited" | "cleared" | "bounced" | "returned" | "replaced";
  bounce_reason: string | null;
  tenant: { id: string; full_name: string } | null;
  lease: { id: string; lease_no: string } | null;
};

type TenantOption = { id: string; name: string };
type LeaseOption = { id: string; lease_no: string; tenant_id: string };

export function ChequeTable({
  cheques,
  tenants,
  leases,
  writable = false,
  locale = "en",
}: {
  cheques: ChequeItem[];
  tenants: TenantOption[];
  leases: LeaseOption[];
  writable?: boolean;
  locale?: string;
}) {
  const t = useTranslations("cheques");
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ChequeState>({});

  // Modals
  const [openRegister, setOpenRegister] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<ChequeItem | null>(null);
  const [bounceTarget, setBounceTarget] = useState<ChequeItem | null>(null);
  const [bounceReason, setBounceReason] = useState("");

  // Register form state
  const [selectedTenant, setSelectedTenant] = useState("");
  const [selectedLease, setSelectedLease] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [amount, setAmount] = useState("");
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  // Replace form state
  const [newChequeNo, setNewChequeNo] = useState("");
  const [newBankName, setNewBankName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newChequeDate, setNewChequeDate] = useState(new Date().toISOString().slice(0, 10));

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setState({});
    const formData = new FormData();
    formData.set("tenantId", selectedTenant);
    formData.set("leaseId", selectedLease);
    formData.set("chequeNo", chequeNo);
    formData.set("bankName", bankName);
    formData.set("amount", amount);
    formData.set("chequeDate", chequeDate);
    if (notes) formData.set("notes", notes);

    startTransition(async () => {
      const res = await registerChequeAction({}, formData);
      setState(res);
      if (res.ok) {
        setOpenRegister(false);
        setChequeNo("");
        setBankName("");
        setAmount("");
        setNotes("");
      }
    });
  };

  const handleDeposit = (chequeId: string) => {
    setState({});
    const formData = new FormData();
    formData.set("chequeId", chequeId);

    startTransition(async () => {
      const res = await depositChequeAction({}, formData);
      setState(res);
    });
  };

  const handleClear = (chequeId: string) => {
    setState({});
    const formData = new FormData();
    formData.set("chequeId", chequeId);

    startTransition(async () => {
      const res = await clearChequeAction({}, formData);
      setState(res);
    });
  };

  const handleBounceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bounceTarget) return;
    setState({});
    const formData = new FormData();
    formData.set("chequeId", bounceTarget.id);
    if (bounceReason) formData.set("reason", bounceReason);

    startTransition(async () => {
      const res = await bounceChequeAction({}, formData);
      setState(res);
      if (res.ok) {
        setBounceTarget(null);
        setBounceReason("");
      }
    });
  };

  const handleReplaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replaceTarget) return;
    setState({});
    const formData = new FormData();
    formData.set("oldChequeId", replaceTarget.id);
    formData.set("chequeNo", newChequeNo);
    formData.set("bankName", newBankName);
    formData.set("amount", newAmount);
    formData.set("chequeDate", newChequeDate);

    startTransition(async () => {
      const res = await replaceChequeAction({}, formData);
      setState(res);
      if (res.ok) {
        setReplaceTarget(null);
        setNewChequeNo("");
        setNewBankName("");
        setNewAmount("");
      }
    });
  };

  const filteredLeases = selectedTenant
    ? leases.filter((l) => l.tenant_id === selectedTenant)
    : leases;

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "cleared":
        return "success";
      case "deposited":
        return "warning";
      case "bounced":
        return "danger";
      case "received":
        return "info";
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
          <Button onClick={() => setOpenRegister(true)} className="flex items-center gap-2">
            <Plus className="size-4" />
            {t("registerCheque")}
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-hairline bg-surface-container-lowest shadow-card">
        {cheques.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Landmark className="size-12 text-on-surface-variant/40" />
            <p className="font-body-md text-body-md text-on-surface-variant">{t("empty")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-start font-body-sm text-body-sm">
              <thead>
                <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                  <th className="p-4 text-start">{t("chequeNo")}</th>
                  <th className="p-4 text-start">{t("bank")}</th>
                  <th className="p-4 text-start">{t("tenant")}</th>
                  <th className="p-4 text-start">{t("lease")}</th>
                  <th className="p-4 text-start">{t("dueDate")}</th>
                  <th className="p-4 text-start">{t("status")}</th>
                  <th className="p-4 text-end">{t("amount")}</th>
                  {writable && <th className="p-4 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {cheques.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-surface-container-low/50">
                    <td className="p-4 font-mono font-semibold text-primary">{c.cheque_no}</td>
                    <td className="p-4 text-on-surface">{c.bank_name || "—"}</td>
                    <td className="p-4 font-medium text-on-surface">
                      {c.tenant ? (
                        <Link
                          href={`/tenants/${c.tenant.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {c.tenant.full_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-4 text-on-surface-variant">
                      {c.lease ? (
                        <Link
                          href={`/leases/${c.lease.id}`}
                          className="font-mono hover:text-primary hover:underline"
                        >
                          {c.lease.lease_no}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-4 text-on-surface-variant">{c.cheque_date}</td>
                    <td className="p-4">
                      <Badge variant={getStatusBadgeVariant(c.status)}>
                        {t(`statuses.${c.status}` as never)}
                      </Badge>
                      {c.bounce_reason && (
                        <p className="mt-0.5 text-[11px] text-error">{c.bounce_reason}</p>
                      )}
                    </td>
                    <td className="p-4 text-end font-semibold text-on-surface">
                      {formatMoney(BigInt(c.amount_minor), c.currency, locale)}
                    </td>
                    {writable && (
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {c.status === "received" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleDeposit(c.id)}
                              disabled={isPending}
                            >
                              {t("deposit")}
                            </Button>
                          )}
                          {c.status === "deposited" && (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleClear(c.id)}
                                disabled={isPending}
                              >
                                {t("clear")}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setBounceTarget(c);
                                  setBounceReason("");
                                }}
                                disabled={isPending}
                              >
                                {t("bounce")}
                              </Button>
                            </>
                          )}
                          {c.status === "bounced" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setReplaceTarget(c);
                                setNewBankName(c.bank_name || "");
                                setNewAmount((c.amount_minor / 100).toFixed(2));
                              }}
                              disabled={isPending}
                            >
                              <ArrowRightLeft className="me-1 size-3.5" />
                              {t("replace")}
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Modal */}
      <Dialog open={openRegister} onOpenChange={setOpenRegister}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("register")}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRegister} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                {t("tenant")} *
              </label>
              <select
                required
                value={selectedTenant}
                onChange={(e) => {
                  setSelectedTenant(e.target.value);
                  setSelectedLease("");
                }}
                className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
              >
                <option value="">Select tenant</option>
                {tenants.map((ten) => (
                  <option key={ten.id} value={ten.id}>
                    {ten.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                {t("lease")} *
              </label>
              <select
                required
                value={selectedLease}
                onChange={(e) => setSelectedLease(e.target.value)}
                className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
              >
                <option value="">Select lease</option>
                {filteredLeases.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.lease_no}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("chequeNo")} *
                </label>
                <input
                  required
                  type="text"
                  value={chequeNo}
                  onChange={(e) => setChequeNo(e.target.value)}
                  placeholder="000123"
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("bank")} *
                </label>
                <input
                  required
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="QNB / CBQ / QIB"
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("dueDate")} *
                </label>
                <input
                  required
                  type="date"
                  value={chequeDate}
                  onChange={(e) => setChequeDate(e.target.value)}
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpenRegister(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {t("registerCheque")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bounce Reason Modal */}
      {bounceTarget && (
        <Dialog
          open
          onOpenChange={(next) => {
            if (!next) setBounceTarget(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Mark Cheque #{bounceTarget.cheque_no} as Bounced</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleBounceSubmit} className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  Bounce Reason
                </label>
                <input
                  type="text"
                  value={bounceReason}
                  onChange={(e) => setBounceReason(e.target.value)}
                  placeholder="Insufficient funds / Signature mismatch"
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setBounceTarget(null)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={isPending}>
                  Confirm Bounce
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Replace Cheque Modal */}
      {replaceTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              Replace Bounced Cheque #{replaceTarget.cheque_no}
            </h2>
            <form onSubmit={handleReplaceSubmit} className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  New Cheque # *
                </label>
                <input
                  required
                  type="text"
                  value={newChequeNo}
                  onChange={(e) => setNewChequeNo(e.target.value)}
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  New Bank Name *
                </label>
                <input
                  required
                  type="text"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                    Amount (QAR) *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                    Due Date *
                  </label>
                  <input
                    required
                    type="date"
                    value={newChequeDate}
                    onChange={(e) => setNewChequeDate(e.target.value)}
                    className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setReplaceTarget(null)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  Create Replacement
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
