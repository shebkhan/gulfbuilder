"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrganizationSettingsAction, type SettingsState } from "@/server/actions/settings";

const selectClass =
  "h-11 w-full rounded-xl bg-surface-container-lowest px-3.5 font-body-md text-body-md text-on-surface shadow-sm outline-none focus:ring-[3px] focus:ring-primary-fixed";

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

export function OrganizationSettingsForm({ values }: { values: OrganizationSettings }) {
  const t = useTranslations("settings.organization");
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    updateOrganizationSettingsAction,
    {},
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">{t("name")}</Label>
          <Input id="name" name="name" defaultValue={values.name} required />
        </div>
        <div>
          <Label htmlFor="legalName">{t("legalName")}</Label>
          <Input id="legalName" name="legalName" defaultValue={values.legalName} />
        </div>
        <div>
          <Label htmlFor="taxId">{t("taxId")}</Label>
          <Input id="taxId" name="taxId" defaultValue={values.taxId} />
        </div>
        <div>
          <Label htmlFor="baseCurrency">{t("baseCurrency")}</Label>
          <select
            id="baseCurrency"
            name="baseCurrency"
            defaultValue={values.baseCurrency}
            className={selectClass}
          >
            {["QAR", "AED", "SAR", "KWD", "BHD", "OMR"].map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="defaultLocale">{t("defaultLocale")}</Label>
          <select
            id="defaultLocale"
            name="defaultLocale"
            defaultValue={values.defaultLocale}
            className={selectClass}
          >
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </div>
        <div>
          <Label htmlFor="timezone">{t("timezone")}</Label>
          <Input id="timezone" name="timezone" defaultValue={values.timezone} required />
        </div>
      </div>

      <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("policy")}</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="graceDays">{t("graceDays")}</Label>
          <Input
            id="graceDays"
            name="graceDays"
            type="number"
            min={0}
            max={90}
            defaultValue={values.graceDays}
          />
        </div>
        <div>
          <Label htmlFor="lateFee">{t("lateFee")}</Label>
          <Input
            id="lateFee"
            name="lateFee"
            defaultValue={values.lateFee}
            inputMode="decimal"
          />
        </div>
        <div>
          <Label htmlFor="lateFeeType">{t("lateFeeType")}</Label>
          <select
            id="lateFeeType"
            name="lateFeeType"
            defaultValue={values.lateFeeType}
            className={selectClass}
          >
            <option value="flat">{t("lateFeeTypes.flat")}</option>
            <option value="percent">{t("lateFeeTypes.percent")}</option>
          </select>
        </div>
        <div>
          <Label htmlFor="lateFeePercent">{t("lateFeePercent")}</Label>
          <Input
            id="lateFeePercent"
            name="lateFeePercent"
            type="number"
            min={0}
            max={100}
            step="0.01"
            defaultValue={values.lateFeePercent}
          />
        </div>
        <div>
          <Label htmlFor="taxRate">{t("taxRate")}</Label>
          <Input
            id="taxRate"
            name="taxRate"
            type="number"
            min={0}
            max={100}
            step="0.01"
            defaultValue={values.taxRate}
          />
        </div>
        <div>
          <Label htmlFor="reminderDays">{t("reminderDays")}</Label>
          <Input
            id="reminderDays"
            name="reminderDays"
            type="number"
            min={0}
            max={60}
            defaultValue={values.reminderDays}
          />
        </div>
        <div>
          <Label htmlFor="revenueRecognition">{t("revenueRecognition")}</Label>
          <select
            id="revenueRecognition"
            name="revenueRecognition"
            defaultValue={values.revenueRecognition}
            className={selectClass}
          >
            <option value="on_due">{t("recognition.on_due")}</option>
            <option value="straight_line_monthly">{t("recognition.straight_line_monthly")}</option>
          </select>
        </div>
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
