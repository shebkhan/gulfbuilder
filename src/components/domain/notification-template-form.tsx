"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateNotificationTemplateAction, type SettingsState } from "@/server/actions/settings";

const selectClass =
  "h-11 w-full rounded-xl bg-surface-container-lowest px-3.5 font-body-md text-body-md text-on-surface shadow-sm outline-none focus:ring-[3px] focus:ring-primary-fixed";

export function NotificationTemplateForm() {
  const t = useTranslations("settings.notifications");
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    updateNotificationTemplateAction,
    {},
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="event">{t("event")}</Label>
          <Input id="event" name="event" defaultValue="rent_due" required dir="ltr" />
        </div>
        <div>
          <Label htmlFor="channel">{t("channel")}</Label>
          <select id="channel" name="channel" defaultValue="email" className={selectClass}>
            {(["email", "whatsapp", "sms", "in_app", "web_push"] as const).map((channel) => (
              <option key={channel} value={channel}>
                {t(`channels.${channel}` as never)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="locale">{t("locale")}</Label>
          <select id="locale" name="locale" defaultValue="en" className={selectClass}>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="subject">{t("subject")}</Label>
        <Input id="subject" name="subject" maxLength={160} />
      </div>

      <div>
        <Label htmlFor="body">{t("body")}</Label>
        <textarea
          id="body"
          name="body"
          rows={4}
          required
          maxLength={4000}
          placeholder={t("bodyPlaceholder")}
          className="w-full rounded-xl bg-surface-container-lowest px-3.5 py-2.5 font-body-md text-body-md text-on-surface shadow-sm outline-none focus:ring-[3px] focus:ring-primary-fixed"
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
        >
          {t(`errors.${state.error}` as never)}
        </p>
      ) : null}
      {state.ok ? (
        <p
          role="status"
          className="rounded-xl bg-secondary-container/50 px-3 py-2 font-body-sm text-body-sm text-on-secondary-container"
        >
          {t("saved")}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
