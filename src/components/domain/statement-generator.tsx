"use client";

import { CreditCard, FileSpreadsheet, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  generateOwnerStatementAction,
  recordOwnerPayoutAction,
  type OwnerState,
} from "@/server/actions/owners";

type OwnerOption = {
  id: string;
  name: string;
};

type BankAccountOption = {
  id: string;
  name: string;
};

export function StatementGenerator({
  owners,
  bankAccounts,
  writable = false,
}: {
  owners: OwnerOption[];
  bankAccounts: BankAccountOption[];
  writable?: boolean;
}) {
  const t = useTranslations("reports");
  const tCommon = useTranslations("common");
  const [openStatement, setOpenStatement] = useState(false);
  const [openPayout, setOpenPayout] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<OwnerState>({});

  // Statement form state
  const [statementOwner, setStatementOwner] = useState("");
  const [periodStart, setPeriodStart] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  );
  const [periodEnd, setPeriodEnd] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
  );

  // Payout form state
  const [payoutOwner, setPayoutOwner] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutRef, setPayoutRef] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");

  const handleStatementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setState({});

    const formData = new FormData();
    formData.set("ownerId", statementOwner);
    formData.set("periodStart", periodStart);
    formData.set("periodEnd", periodEnd);

    startTransition(async () => {
      const res = await generateOwnerStatementAction({}, formData);
      setState(res);
      if (res.ok) setOpenStatement(false);
    });
  };

  const handlePayoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setState({});

    const formData = new FormData();
    formData.set("ownerId", payoutOwner);
    formData.set("amount", payoutAmount);
    if (payoutRef) formData.set("reference", payoutRef);
    if (bankAccountId) formData.set("bankAccountId", bankAccountId);

    startTransition(async () => {
      const res = await recordOwnerPayoutAction({}, formData);
      setState(res);
      if (res.ok) {
        setOpenPayout(false);
        setPayoutAmount("");
        setPayoutRef("");
      }
    });
  };

  if (!writable) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {state.error && (
          <div className="w-full rounded-xl bg-error-container p-3 font-body-sm text-body-sm text-on-error-container">
            {state.error}
          </div>
        )}
        <Button
          variant="secondary"
          onClick={() => setOpenStatement(true)}
          className="flex items-center gap-2"
        >
          <FileSpreadsheet className="size-4" />
          {t("generateStatement")}
        </Button>
        <Button onClick={() => setOpenPayout(true)} className="flex items-center gap-2">
          <CreditCard className="size-4" />
          {t("recordPayout")}
        </Button>
      </div>

      {/* Generate Statement Modal */}
      {openStatement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                {t("generateStatement")}
              </h2>
              <button
                type="button"
                onClick={() => setOpenStatement(false)}
                className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container-high"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleStatementSubmit} className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("owner")} *
                </label>
                <Select required value={statementOwner} onValueChange={setStatementOwner}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectOwner")} />
                  </SelectTrigger>
                  <SelectContent>
                    {owners.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                    {t("periodStart")} *
                  </label>
                  <Input
                    required
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                    {t("periodEnd")} *
                  </label>
                  <Input
                    required
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpenStatement(false)}
                  disabled={isPending}
                >
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {t("generateStatement")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payout Modal */}
      {openPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                {t("recordPayout")}
              </h2>
              <button
                type="button"
                onClick={() => setOpenPayout(false)}
                className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container-high"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handlePayoutSubmit} className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("owner")} *
                </label>
                <Select required value={payoutOwner} onValueChange={setPayoutOwner}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectOwner")} />
                  </SelectTrigger>
                  <SelectContent>
                    {owners.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("amountQar")} *
                </label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("disbursingBank")}
                </label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("defaultOperatingAccount")} />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {t("bankReference")}
                </label>
                <Input
                  type="text"
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                  placeholder={t("payoutRefPlaceholder")}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpenPayout(false)}
                  disabled={isPending}
                >
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {t("recordPayout")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
