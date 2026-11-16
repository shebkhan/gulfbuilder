import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OrganizationSettingsForm } from "@/components/domain/organization-settings-form";
import { SettingsNav } from "@/components/domain/settings-nav";
import { can, isRole } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function OrganizationSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const role = membership && isRole(membership.role) ? membership.role : "tenant";
  if (!can(role, "settings.write")) redirect(`/${locale}/dashboard`);

  const { data: org } = await supabase
    .from("organizations")
    .select("name, legal_name, tax_id, base_currency, default_locale, timezone, settings")
    .eq("id", membership!.org_id)
    .maybeSingle();

  const settings = (org?.settings ?? {}) as Record<string, number | string>;
  const t = await getTranslations("settings.organization");

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <p className="max-w-xl font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
      </div>

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
