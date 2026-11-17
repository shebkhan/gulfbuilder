"use client";

import { CreditCard, FileSpreadsheet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
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

export function StatementGenerator({ writable = false }: { writable?: boolean }) {
  const t = useTranslations("reports");

  if (!writable) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" asChild className="flex items-center gap-2">
        <Link href="/reports/statements/new">
          <FileSpreadsheet className="size-4" />
          {t("generateStatement")}
        </Link>
      </Button>
      <Button asChild className="flex items-center gap-2">
        <Link href="/reports/payouts/new">
          <CreditCard className="size-4" />
          {t("recordPayout")}
        </Link>
      </Button>
    </div>
  );
}

export function StatementForm({ owners }: { owners: OwnerOption[] }) {
  const t = useTranslations("reports");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<OwnerState>({});

  const [owner, setOwner] = useState("");
  const [periodStart, setPeriodStart] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  );
  const [periodEnd, setPeriodEnd] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
  );

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setState({});

    const formData = new FormData();
    formData.set("ownerId", owner);
    formData.set("periodStart", periodStart);
    formData.set("periodEnd", periodEnd);

    startTransition(async () => setState(await generateOwnerStatementAction({}, formData)));
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-error-container p-3 font-body-sm text-body-sm text-on-error-container"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="statement-owner">{t("owner")} *</Label>
        <Select required value={owner} onValueChange={setOwner}>
          <SelectTrigger id="statement-owner">
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
          <Label htmlFor="statement-from">{t("periodStart")} *</Label>
          <Input
            id="statement-from"
            required
            type="date"
            value={periodStart}
            onChange={(event) => setPeriodStart(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="statement-to">{t("periodEnd")} *</Label>
          <Input
            id="statement-to"
            required
            type="date"
            value={periodEnd}
            onChange={(event) => setPeriodEnd(event.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" asChild>
          <Link href="/reports">{tCommon("cancel")}</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {t("generateStatement")}
        </Button>
      </div>
    </form>
  );
}

export function PayoutForm({
  owners,
  bankAccounts,
}: {
  owners: OwnerOption[];
  bankAccounts: BankAccountOption[];
}) {
  const t = useTranslations("reports");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<OwnerState>({});

  const [owner, setOwner] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setState({});

    const formData = new FormData();
    formData.set("ownerId", owner);
    formData.set("amount", amount);
    if (reference) formData.set("reference", reference);
    if (bankAccountId) formData.set("bankAccountId", bankAccountId);

    startTransition(async () => {
      const res = await recordOwnerPayoutAction({}, formData);
      setState(res);
      if (res.ok) {
        setAmount("");
        setReference("");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-error-container p-3 font-body-sm text-body-sm text-on-error-container"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="payout-owner">{t("owner")} *</Label>
        <Select required value={owner} onValueChange={setOwner}>
          <SelectTrigger id="payout-owner">
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
        <Label htmlFor="payout-amount">{t("amountQar")} *</Label>
        <Input
          id="payout-amount"
          required
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="payout-bank">{t("disbursingBank")}</Label>
        <Select value={bankAccountId} onValueChange={setBankAccountId}>
          <SelectTrigger id="payout-bank">
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
        <Label htmlFor="payout-ref">{t("bankReference")}</Label>
        <Input
          id="payout-ref"
          type="text"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder={t("payoutRefPlaceholder")}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" asChild>
          <Link href="/reports">{tCommon("cancel")}</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {t("recordPayout")}
        </Button>
      </div>
    </form>
  );
}
