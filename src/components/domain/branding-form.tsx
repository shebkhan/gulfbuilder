"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function BrandingForm({ values }: { values: BrandingValues }) {
  const t = useTranslations("settings.branding");
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    updateBrandingAction,
    {},
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="appName">{t("appName")}</Label>
          <Input id="appName" name="appName" defaultValue={values.appName} />
        </div>
        <div>
          <Label htmlFor="fontFamily">{t("fontFamily")}</Label>
          <Input id="fontFamily" name="fontFamily" defaultValue={values.fontFamily} />
        </div>
        <div>
          <Label htmlFor="logoUrl">{t("logoUrl")}</Label>
          <Input id="logoUrl" name="logoUrl" defaultValue={values.logoUrl} dir="ltr" />
        </div>
        <div>
          <Label htmlFor="faviconUrl">{t("faviconUrl")}</Label>
          <Input id="faviconUrl" name="faviconUrl" defaultValue={values.faviconUrl} dir="ltr" />
        </div>
        <div>
          <Label htmlFor="primaryColor">{t("primaryColor")}</Label>
          <Input
            id="primaryColor"
            name="primaryColor"
            defaultValue={values.primaryColor}
            placeholder="#795919"
            dir="ltr"
          />
        </div>
        <div>
          <Label htmlFor="secondaryColor">{t("secondaryColor")}</Label>
          <Input
            id="secondaryColor"
            name="secondaryColor"
            defaultValue={values.secondaryColor}
            placeholder="#156c47"
            dir="ltr"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="terminology">{t("terminology")}</Label>
        <textarea
          id="terminology"
          name="terminology"
          rows={5}
          defaultValue={values.terminology}
          placeholder='{"leases": "Tenancy contracts"}'
          dir="ltr"
          className="w-full rounded-xl bg-surface-container-lowest px-3.5 py-2.5 font-body-md text-body-md text-on-surface shadow-sm outline-none focus:ring-[3px] focus:ring-primary-fixed"
        />
      </div>

      <div>
        <Label htmlFor="customDomain">{t("customDomain")}</Label>
        <Input
          id="customDomain"
          name="customDomain"
          defaultValue={values.customDomain}
          placeholder="property.example.com"
          dir="ltr"
        />
        <p className="mt-1.5 font-body-sm text-body-sm text-on-surface-variant">
          {t("customDomainHint")}
          {values.customDomainStatus && values.customDomainStatus !== "none"
            ? ` (${t(`domainStatus.${values.customDomainStatus}` as never)})`
            : ""}
        </p>
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
