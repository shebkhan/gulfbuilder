"use client";

import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
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
      className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-container-lowest p-4"
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="font-label-sm text-label-sm font-semibold text-on-surface">
            {t("amount")} (QAR)
          </span>
          <input
            required
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-label-sm text-label-sm font-semibold text-on-surface">
            {t("method")}
          </span>
          <select
            name="method"
            defaultValue="bank_transfer"
            className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="bank_transfer">{t("methods.bank_transfer")}</option>
            <option value="cash">{t("methods.cash")}</option>
            <option value="cheque">{t("methods.cheque")}</option>
            <option value="card">{t("methods.card")}</option>
            <option value="online">{t("methods.online")}</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-label-sm text-label-sm font-semibold text-on-surface">
          {t("date")}
        </span>
        <input
          required
          name="receivedOn"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-label-sm text-label-sm font-semibold text-on-surface">
          {t("note")}
        </span>
        <input
          name="note"
          type="text"
          placeholder={t("notePlaceholder")}
          className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-label-sm text-label-sm font-semibold text-on-surface">
          {t("proof")}
        </span>
        <input
          required
          name="proof"
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="rounded-xl border border-hairline bg-surface-container-low px-3 py-2 font-body-sm text-body-sm text-on-surface file:me-3 file:rounded-full file:border-0 file:bg-surface-container-high file:px-3 file:py-1 file:font-label-sm file:text-label-sm"
        />
      </label>

      <Button type="submit" disabled={isPending} className="flex items-center justify-center gap-2">
        <Upload className="size-4" />
        {isPending ? t("submitting") : t("submit")}
      </Button>
      <input type="hidden" name="locale" value={locale} />
    </form>
  );
}
