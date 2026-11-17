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
  FormDescription,
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
import { toFormData } from "@/lib/form-data";
import { organizationSchema } from "@/schemas/settings";
import { updateOrganizationSettingsAction, type SettingsState } from "@/server/actions/settings";

export type OrganizationSettings = {
  name: string;
  legalName: string;
  taxId: string;
  baseCurrency: string;
  defaultLocale: string;
  timezone: string;
  graceDays: number;
  lateFee: string;
  lateFeeType: string;
  lateFeePercent: number;
  taxRate: number;
  reminderDays: number;
  revenueRecognition: string;
};

type Values = OrganizationSettings;

const CURRENCIES = ["QAR", "AED", "SAR", "KWD", "BHD", "OMR"] as const;

export function OrganizationSettingsForm({ values }: { values: OrganizationSettings }) {
  const t = useTranslations("settings.organization");
  const errors = t.raw("errors") as Record<string, string>;

  const form = useForm<Values>({
    resolver: zodResolver(organizationSchema),
    defaultValues: values,
  });

  const [state, dispatch, pending] = useActionState<SettingsState, FormData>(
    updateOrganizationSettingsAction,
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
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("name")}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="legalName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("legalName")}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="taxId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("taxId")}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="baseCurrency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("baseCurrency")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CURRENCIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>{t("baseCurrencyHint")}</FormDescription>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultLocale"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("defaultLocale")}</FormLabel>
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

          <FormField
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("timezone")}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />
        </div>

        <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("policy")}</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="graceDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("graceDays")}</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={0} max={90} />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lateFee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("lateFee")}</FormLabel>
                <FormControl>
                  <Input {...field} inputMode="decimal" />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lateFeeType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("lateFeeType")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="flat">{t("lateFeeTypes.flat")}</SelectItem>
                    <SelectItem value="percent">{t("lateFeeTypes.percent")}</SelectItem>
                  </SelectContent>
                </Select>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lateFeePercent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("lateFeePercent")}</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={0} max={100} step="0.01" />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="taxRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("taxRate")}</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={0} max={100} step="0.01" />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reminderDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("reminderDays")}</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={0} max={60} />
                </FormControl>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="revenueRecognition"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("revenueRecognition")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="on_due">{t("recognition.on_due")}</SelectItem>
                    <SelectItem value="straight_line_monthly">
                      {t("recognition.straight_line_monthly")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <LocalizedFormMessage />
              </FormItem>
            )}
          />
        </div>

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
