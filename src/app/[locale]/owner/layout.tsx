import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/domain/app-shell";
import { OWNER_NAV } from "@/components/domain/nav-items";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBrand } from "@/lib/white-label";

/** Owner portal (SPEC §8 O1): read-only, the owner's own buildings only. */
export default async function OwnerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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

  if (!membership) redirect(`/${locale}/onboarding`);
  if (membership.role !== "owner") redirect(`/${locale}/dashboard`);

  const { data: enabled } = await supabase.rpc("org_feature_enabled", {
    p_org: membership.org_id,
    p_feature: "owner_portal",
  });
  if (enabled === false) redirect(`/${locale}/dashboard`);

  const { data: org } = await supabase
    .from("organizations")
    .select("name, base_currency")
    .eq("id", membership.org_id)
    .maybeSingle();

  const { data: owner } = await supabase
    .from("owners")
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const t = await getTranslations("common");

  return (
    <AppShell
      orgName={owner?.name ?? org?.name ?? t("appName")}
      currency={org?.base_currency ?? t("currency")}
      role="owner"
      userName={profile?.full_name ?? owner?.name ?? user.email?.split("@")[0] ?? ""}
      locale={locale}
      logoUrl={(await getBrand())?.logoUrl}
      items={OWNER_NAV}
      footerItems={[]}
    >
      {children}
    </AppShell>
  );
}
