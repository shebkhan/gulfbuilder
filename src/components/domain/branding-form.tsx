"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LocalizedFormMessage } from "@/components/domain/localized-form-message";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toFormData } from "@/lib/form-data";
import { brandingSchema } from "@/schemas/settings";
import { updateBrandingAction, type SettingsState } from "@/server/actions/settings";

export type BrandingValues = {
  appName: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  terminology: string;
  customDomain: string;
  customDomainStatus: string;
};

type Values = Omit<BrandingValues, "customDomainStatus">;

export function BrandingForm({ values }: { values: BrandingValues }) {
  const t = useTranslations("settings.branding");
  const errors = t.raw("errors") as Record<string, string>;

  const form = useForm<Values>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      appName: values.appName,
      logoUrl: values.logoUrl,
      faviconUrl: values.faviconUrl,
      primaryColor: values.primaryColor,
      secondaryColor: values.secondaryColor,
      fontFamily: values.fontFamily,
      terminology: values.terminology,
      customDomain: values.customDomain,
    },
  });

  const [state, dispatch, pending] = useActionState<SettingsState, FormData>(
    updateBrandingAction,
    {},
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((formValues) => dispatch(toFormData(formValues)))}
        noValidate
        className="flex max-w-2xl flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="appName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("appName")}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fontFamily"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("fontFamily")}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="logoUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("logoUrl")}</FormLabel>
                <FormControl>
                  <Input {...field} dir="ltr" />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="faviconUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("faviconUrl")}</FormLabel>
                <FormControl>
                  <Input {...field} dir="ltr" />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="primaryColor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("primaryColor")}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="#795919" dir="ltr" />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="secondaryColor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("secondaryColor")}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="#156c47" dir="ltr" />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="terminology"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("terminology")}</FormLabel>
              <FormControl>
                <Textarea rows={5} {...field} placeholder={t("terminologyPlaceholder")} dir="ltr" />
              </FormControl>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="customDomain"
          render={({ field }) => (
            <FormItem>
              <FormLabel
                description={
                  t("customDomainHint") +
                  (values.customDomainStatus && values.customDomainStatus !== "none"
                    ? ` (${t(`domainStatus.${values.customDomainStatus}` as never)})`
                    : "")
                }
              >
                {t("customDomain")}
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder="property.example.com" dir="ltr" />
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
