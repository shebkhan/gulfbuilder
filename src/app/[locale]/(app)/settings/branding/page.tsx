import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BrandingForm } from "@/components/domain/branding-form";
import { PageHeader } from "@/components/domain/page-header";
import { SettingsNav } from "@/components/domain/settings-nav";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

export default async function BrandingSettingsPage({
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

  const { data: branding } = await supabase
    .from("org_branding")
    .select(
      "app_name, logo_url, favicon_url, primary_color, secondary_color, font_family, terminology, custom_domain, custom_domain_status",
    )
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  const { data: presets } = await supabase
    .from("theme_presets")
    .select("code, name, primary_color, secondary_color, font_family")
    .order("name");

  const terminology = branding?.terminology ?? {};
  const t = await getTranslations("settings.branding");

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="settings"
        role={role}
        title={t("title")}
        description={t("subtitle")}
      />
      <SettingsNav />
      <BrandingForm
        values={{
          appName: branding?.app_name ?? "",
          logoUrl: branding?.logo_url ?? "",
          faviconUrl: branding?.favicon_url ?? "",
          primaryColor: branding?.primary_color ?? "",
          secondaryColor: branding?.secondary_color ?? "",
          fontFamily: branding?.font_family ?? "",
          terminology: Object.keys(terminology).length ? JSON.stringify(terminology, null, 2) : "",
          customDomain: branding?.custom_domain ?? "",
          customDomainStatus: branding?.custom_domain_status ?? "none",
        }}
        presets={(presets ?? []).map((preset) => ({
          code: preset.code,
          name: preset.name,
          primaryColor: preset.primary_color,
          secondaryColor: preset.secondary_color,
          fontFamily: preset.font_family,
        }))}
      />
    </div>
  );
}
