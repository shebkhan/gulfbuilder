"use client";

import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberField } from "@/components/ui/number-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitPaymentProofAction, type PortalState } from "@/server/actions/portal";

export function PaymentProofForm({ locale = "en" }: { locale?: string }) {
  const t = useTranslations("portal.payments");
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<PortalState>({});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({});
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await submitPaymentProofAction({}, formData);
      setState(result);
      if (result.ok) event.currentTarget.reset();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-xl border border-hairline bg-surface-container-lowest p-4"
    >
      <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("uploadTitle")}</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant">{t("uploadHint")}</p>

      {state.error && (
        <p className="rounded-lg bg-error-container p-3 font-body-sm text-body-sm text-on-error-container">
          {t(`errors.${state.error}` as never)}
        </p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-secondary-container p-3 font-body-sm text-body-sm text-on-secondary-container">
          {t("submitted")}
        </p>
      )}

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="proof-amount">{t("amount")} (QAR)</Label>
          <NumberField
            id="proof-amount"
            required
            name="amount"
            step="0.01"
            min="0.01"
            inputMode="decimal"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="proof-method">{t("method")}</Label>
          <Select name="method" defaultValue="bank_transfer">
            <SelectTrigger id="proof-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_transfer">{t("methods.bank_transfer")}</SelectItem>
              <SelectItem value="cash">{t("methods.cash")}</SelectItem>
              <SelectItem value="cheque">{t("methods.cheque")}</SelectItem>
              <SelectItem value="card">{t("methods.card")}</SelectItem>
              <SelectItem value="online">{t("methods.online")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="proof-date">{t("date")}</Label>
        <DatePicker
          id="proof-date"
          required
          name="receivedOn"
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="proof-note">{t("note")}</Label>
        <Input id="proof-note" name="note" type="text" placeholder={t("notePlaceholder")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="proof-file">{t("proof")}</Label>
        <Input
          id="proof-file"
          required
          name="proof"
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="py-2 font-body-sm text-body-sm file:me-3 file:rounded-full file:border-0 file:bg-surface-container-high file:px-3 file:py-1 file:font-label-sm file:text-label-sm"
        />
      </div>

      <Button type="submit" disabled={isPending} className="flex items-center justify-center gap-2">
        <Upload className="size-4" />
        {isPending ? t("submitting") : t("submit")}
      </Button>
      <input type="hidden" name="locale" value={locale} />
    </form>
  );
}
