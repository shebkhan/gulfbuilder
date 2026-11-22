import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OrganizationSettingsForm } from "@/components/domain/organization-settings-form";
import { SettingsNav } from "@/components/domain/settings-nav";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";

export default async function OrganizationSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) redirect(`/${locale}/login`);
  if (!can(ctx.role, "settings.write")) redirect(`/${locale}/dashboard`);

  const role = ctx.role;
  const supabase = ctx.supabase;

  const { data: org } = await supabase
    .from("organizations")
    .select("name, legal_name, tax_id, base_currency, default_locale, timezone, settings")
    .eq("id", ctx.orgId)
    .maybeSingle();

  const settings = (org?.settings ?? {}) as Record<string, number | string>;
  const t = await getTranslations("settings.organization");

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="settings"
        role={role}
        title={t("title")}
        description={t("subtitle")}
      />

      <SettingsNav />

      <OrganizationSettingsForm
        values={{
          name: org?.name ?? "",
          legalName: org?.legal_name ?? "",
          taxId: org?.tax_id ?? "",
          baseCurrency: org?.base_currency ?? "QAR",
          defaultLocale: org?.default_locale ?? "en",
          timezone: org?.timezone ?? "Asia/Qatar",
          graceDays: Number(settings.grace_days ?? 0),
          lateFee: (Number(settings.late_fee_minor ?? 0) / 100).toFixed(2),
          lateFeeType: String(settings.late_fee_type ?? "flat"),
          lateFeePercent: Number(settings.late_fee_percent ?? 0),
          taxRate: Number(settings.tax_rate ?? 0),
          reminderDays: Number(settings.reminder_days ?? 0),
          revenueRecognition: String(settings.revenue_recognition ?? "on_due"),
        }}
      />
    </div>
  );
}
