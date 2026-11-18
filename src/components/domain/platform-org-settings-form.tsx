"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type PlatformState } from "@/server/actions/platform";
import { saveOrgSettingsAction } from "@/server/actions/platform-org";
import type { OrganizationSettings } from "./organization-settings-form";

const CURRENCIES = ["QAR", "AED", "SAR", "KWD", "BHD", "OMR"] as const;

export function PlatformOrgSettingsForm({
  orgId,
  values,
}: {
  orgId: string;
  values: OrganizationSettings;
}) {
  const t = useTranslations("settings.organization");
  const tp = useTranslations("platform");
  const [state, action, pending] = useActionState<PlatformState, FormData>(
    saveOrgSettingsAction,
    {},
  );

  return (
    <form action={action} className="grid max-w-2xl gap-x-4 gap-y-6 sm:grid-cols-2">
      <input type="hidden" name="orgId" value={orgId} />
      <div>
        <Label htmlFor="pf-name">{t("name")}</Label>
        <Input id="pf-name" name="name" defaultValue={values.name} required />
      </div>
      <div>
        <Label htmlFor="pf-legalName">{t("legalName")}</Label>
        <Input id="pf-legalName" name="legalName" defaultValue={values.legalName} />
      </div>
      <div>
        <Label htmlFor="pf-taxId">{t("taxId")}</Label>
        <Input id="pf-taxId" name="taxId" defaultValue={values.taxId} />
      </div>
      <div>
        <Label htmlFor="pf-baseCurrency">{t("baseCurrency")}</Label>
        <Select name="baseCurrency" defaultValue={values.baseCurrency}>
          <SelectTrigger id="pf-baseCurrency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="pf-defaultLocale">{t("defaultLocale")}</Label>
        <Select name="defaultLocale" defaultValue={values.defaultLocale}>
          <SelectTrigger id="pf-defaultLocale">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">{t("languages.en")}</SelectItem>
            <SelectItem value="ar">{t("languages.ar")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="pf-timezone">{t("timezone")}</Label>
        <Input id="pf-timezone" name="timezone" defaultValue={values.timezone} required />
      </div>
      <div>
        <Label htmlFor="pf-graceDays">{t("graceDays")}</Label>
        <Input
          id="pf-graceDays"
          name="graceDays"
          type="number"
          min={0}
          max={90}
          defaultValue={values.graceDays}
          required
        />
      </div>
      <div>
        <Label htmlFor="pf-lateFee">{t("lateFee")}</Label>
        <Input id="pf-lateFee" name="lateFee" defaultValue={values.lateFee} required />
      </div>
      <div>
        <Label htmlFor="pf-lateFeeType">{t("lateFeeType")}</Label>
        <Select name="lateFeeType" defaultValue={values.lateFeeType}>
          <SelectTrigger id="pf-lateFeeType">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="flat">{t("lateFeeTypes.flat")}</SelectItem>
            <SelectItem value="percent">{t("lateFeeTypes.percent")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="pf-lateFeePercent">{t("lateFeePercent")}</Label>
        <Input
          id="pf-lateFeePercent"
          name="lateFeePercent"
          type="number"
          min={0}
          max={100}
          step="0.01"
          defaultValue={values.lateFeePercent}
          required
        />
      </div>
      <div>
        <Label htmlFor="pf-taxRate">{t("taxRate")}</Label>
        <Input
          id="pf-taxRate"
          name="taxRate"
          type="number"
          min={0}
          max={100}
          step="0.01"
          defaultValue={values.taxRate}
          required
        />
      </div>
      <div>
        <Label htmlFor="pf-reminderDays">{t("reminderDays")}</Label>
        <Input
          id="pf-reminderDays"
          name="reminderDays"
          type="number"
          min={0}
          max={60}
          defaultValue={values.reminderDays}
          required
        />
      </div>
      <div>
        <Label htmlFor="pf-revenueRecognition">{t("revenueRecognition")}</Label>
        <Select name="revenueRecognition" defaultValue={values.revenueRecognition}>
          <SelectTrigger id="pf-revenueRecognition">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="on_due">{t("recognition.on_due")}</SelectItem>
            <SelectItem value="straight_line_monthly">
              {t("recognition.straight_line_monthly")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="sm:col-span-2">
        {state.error ? (
          <p role="alert" className="font-body-sm text-error">
            {tp(`errors.${state.error}` as never)}
          </p>
        ) : null}
        {state.ok ? (
          <p role="status" className="font-body-sm text-secondary">
            {tp("settings.saved")}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending} className="self-start sm:col-span-2">
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
