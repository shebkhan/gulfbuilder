import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { BrandingForm } from "@/components/domain/branding-form";
import { SettingsNav } from "@/components/domain/settings-nav";
import { can, isRole } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function BrandingSettingsPage({
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

  const { data: branding } = await supabase
    .from("org_branding")
    .select(
      "app_name, logo_url, favicon_url, primary_color, secondary_color, font_family, terminology, custom_domain, custom_domain_status",
    )
    .eq("org_id", membership!.org_id)
    .maybeSingle();

  const terminology = branding?.terminology ?? {};

  return (
    <div className="flex flex-col gap-space-lg pt-2">
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
      />
    </div>
  );
}
