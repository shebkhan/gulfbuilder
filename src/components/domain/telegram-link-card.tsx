"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import {
  generateTelegramLinkCodeAction,
  unlinkTelegramAction,
  type SettingsState,
} from "@/server/actions/settings";

export function TelegramLinkCard({ linked, code }: { linked: boolean; code: string | null }) {
  const t = useTranslations("settings.notifications");
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const [generateState, generateAction, generating] = useActionState<SettingsState, FormData>(
    generateTelegramLinkCodeAction,
    {},
  );
  const [unlinkState, unlinkAction, unlinking] = useActionState<SettingsState, FormData>(
    unlinkTelegramAction,
    {},
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{t("telegramTitle")}</CardTitle>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{t("telegramSubtitle")}</p>
      </CardHeader>
      <CardBody className="flex flex-col gap-3 pt-0">
        {linked ? (
          <p
            role="status"
            className="font-body-sm text-body-sm text-on-secondary-container"
          >
            {t("linked")}
          </p>
        ) : null}

        {code ? (
          <div className="flex flex-col gap-1">
            <p dir="ltr" className="font-body-md text-body-md font-medium text-on-surface">
              /start {code}
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{t("codeHint")}</p>
            {botUsername ? (
              <span dir="ltr" className="font-body-sm text-body-sm text-on-surface-variant">
                @{botUsername}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <form action={generateAction}>
            <Button type="submit" disabled={generating}>
              {t("generateCode")}
            </Button>
          </form>
          {linked ? (
            <form action={unlinkAction}>
              <Button type="submit" variant="ghost" disabled={unlinking}>
                {t("unlink")}
              </Button>
            </form>
          ) : null}
        </div>

        {generateState.error || unlinkState.error ? (
          <p
            role="alert"
            className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
          >
            {t(`errors.${generateState.error ?? unlinkState.error}` as never)}
          </p>
        ) : null}
        {generateState.ok === "code_generated" ? (
          <p
            role="status"
            className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container"
          >
            {t("codeGenerated")}
          </p>
        ) : null}
        {unlinkState.ok === "unlinked" ? (
          <p
            role="status"
            className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container"
          >
            {t("unlinked")}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
