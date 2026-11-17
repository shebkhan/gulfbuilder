"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LocalizedFormMessage } from "@/components/domain/localized-form-message";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toFormData } from "@/lib/form-data";
import { createOrgSchema, type OrgState } from "@/schemas/auth";
import { createOrganizationAction } from "@/server/actions/auth";

type Props = {
  locale: string;
  pendingLabel: string;
  labels: { orgName: string; slug: string; market: string; currency: string; create: string };
  markets: { value: string; label: string }[];
  currencies: string[];
};

type Values = {
  name: string;
  slug: string;
  countryCode: string;
  baseCurrency: string;
  locale: "en" | "ar";
};

export function OrgForm({ locale, pendingLabel, labels, markets, currencies }: Props) {
  const t = useTranslations("auth");
  const to = useTranslations("onboarding");
  const errors = t.raw("errors") as Record<string, string>;

  const form = useForm<Values>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: "",
      slug: "",
      countryCode: "QA",
      baseCurrency: "QAR",
      locale: locale as Values["locale"],
    },
  });

  const [state, dispatch, pending] = useActionState<OrgState, FormData>(
    createOrganizationAction,
    {},
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => {
          const formData = toFormData(values);
          formData.set("uiLocale", locale);
          dispatch(formData);
        })}
        noValidate
        className="flex flex-col gap-6"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.orgName}</FormLabel>
              <FormControl>
                <Input {...field} autoComplete="organization" />
              </FormControl>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel description={to("slugHint")}>{labels.slug}</FormLabel>
              <FormControl>
                <Input {...field} placeholder="doha-towers" dir="ltr" />
              </FormControl>
              <LocalizedFormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="countryCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{labels.market}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {markets.map((market) => (
                      <SelectItem key={market.value} value={market.value}>
                        {market.label}
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
            name="baseCurrency"
            render={({ field }) => (
              <FormItem>
                <FormLabel description={to("currencyHint")}>{labels.currency}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
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

        <Button type="submit" size="lg" disabled={pending} className="mt-1">
          {pending ? pendingLabel : labels.create}
        </Button>
      </form>
    </Form>
  );
}
