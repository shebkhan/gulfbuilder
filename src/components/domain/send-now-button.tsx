"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { sendNotificationsNowAction, type SettingsState } from "@/server/actions/settings";

export function SendNowButton() {
  const t = useTranslations("settings.notifications");
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    sendNotificationsNowAction,
    {},
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="font-body-sm text-body-sm text-on-surface-variant">{t("sendNowHint")}</p>
      <form action={formAction}>
        <Button type="submit" size="lg" disabled={pending} className="self-start">
          {t("sendNow")}
        </Button>
      </form>
      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
        >
          {t(`errors.${state.error}` as never)}
        </p>
      ) : null}
      {state.ok === "dispatched" ? (
        <p
          role="status"
          className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container"
        >
          {t("dispatched")}
        </p>
      ) : null}
    </div>
  );
}
