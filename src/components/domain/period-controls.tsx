"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MonthPicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  closePeriodAction,
  reopenPeriodAction,
  runOverdueSweepAction,
  type SettingsState,
} from "@/server/actions/settings";

export function PeriodControls() {
  const t = useTranslations("settings.accounting");
  const [closeState, closeAction, closePending] = useActionState<SettingsState, FormData>(
    closePeriodAction,
    {},
  );
  const [reopenState, reopenAction, reopenPending] = useActionState<SettingsState, FormData>(
    reopenPeriodAction,
    {},
  );
  const [sweepState, sweepAction, sweepPending] = useActionState<SettingsState, FormData>(
    runOverdueSweepAction,
    {},
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={closeAction} className="flex max-w-xl flex-col gap-3">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("closePeriod")}</h2>
        <div>
          <Label htmlFor="closeMonth">{t("month")}</Label>
          <MonthPicker id="closeMonth" name="month" required />
        </div>
        {closeState.error ? (
          <p
            role="alert"
            className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
          >
            {t(`errors.${closeState.error}` as never)}
          </p>
        ) : null}
        {closeState.ok ? (
          <p
            role="status"
            className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container"
          >
            {t("periodClosed")}
          </p>
        ) : null}
        <Button type="submit" disabled={closePending} className="self-start">
          {closePending ? t("working") : t("close")}
        </Button>
      </form>

      <form action={reopenAction} className="flex max-w-xl flex-col gap-3">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("reopenPeriod")}</h2>
        <div>
          <Label htmlFor="reopenMonth">{t("month")}</Label>
          <MonthPicker id="reopenMonth" name="month" required />
        </div>
        <div>
          <Label htmlFor="reason">{t("reason")}</Label>
          <Input id="reason" name="reason" required />
        </div>
        {reopenState.error ? (
          <p
            role="alert"
            className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
          >
            {t(`errors.${reopenState.error}` as never)}
          </p>
        ) : null}
        {reopenState.ok ? (
          <p
            role="status"
            className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container"
          >
            {t("periodReopened")}
          </p>
        ) : null}
        <Button type="submit" variant="secondary" disabled={reopenPending} className="self-start">
          {reopenPending ? t("working") : t("reopen")}
        </Button>
      </form>

      <form action={sweepAction} className="flex max-w-xl flex-col gap-3">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("overdueSweep")}</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{t("overdueSweepHint")}</p>
        {sweepState.error ? (
          <p
            role="alert"
            className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
          >
            {t(`errors.${sweepState.error}` as never)}
          </p>
        ) : null}
        {sweepState.ok ? (
          <p
            role="status"
            className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container"
          >
            {t("sweepDone")}
          </p>
        ) : null}
        <Button type="submit" variant="secondary" disabled={sweepPending} className="self-start">
          {sweepPending ? t("working") : t("runSweep")}
        </Button>
      </form>
    </div>
  );
}
