"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LocalizedFormMessage } from "@/components/domain/localized-form-message";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toFormData } from "@/lib/form-data";
import { templateSchema } from "@/schemas/settings";
import { updateNotificationTemplateAction, type SettingsState } from "@/server/actions/settings";

type Values = {
  event: string;
  channel: "email" | "sms" | "telegram" | "push";
  locale: "en" | "ar";
  subject: string;
  body: string;
};

const CHANNELS = ["email", "sms", "telegram", "push"] as const;

export function NotificationTemplateForm() {
  const t = useTranslations("settings.notifications");
  const errors = t.raw("errors") as Record<string, string>;

  const form = useForm<Values>({
    resolver: zodResolver(templateSchema),
    defaultValues: { event: "rent_due", channel: "email", locale: "en", subject: "", body: "" },
  });

  const [state, dispatch, pending] = useActionState<SettingsState, FormData>(
    updateNotificationTemplateAction,
    {},
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => dispatch(toFormData(values)))}
        noValidate
        className="flex max-w-2xl flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="event"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("event")}</FormLabel>
                <FormControl>
                  <Input {...field} dir="ltr" />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="channel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("channel")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CHANNELS.map((channel) => (
                      <SelectItem key={channel} value={channel}>
                        {t(`channels.${channel}` as never)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="locale"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("locale")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="en">{t("languages.en")}</SelectItem>
                    <SelectItem value="ar">{t("languages.ar")}</SelectItem>
                  </SelectContent>
                </Select>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("subject")}</FormLabel>
              <FormControl>
                <Input {...field} maxLength={160} />
              </FormControl>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("body")}</FormLabel>
              <FormControl>
                <Textarea rows={4} {...field} maxLength={4000} placeholder={t("bodyPlaceholder")} />
              </FormControl>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        {state.error ? (
          <p
            role="alert"
            className="rounded-xl bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container"
          >
            {errors[state.error] ?? state.error}
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
    </Form>
  );
}
