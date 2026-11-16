import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/domain/app-shell";
import { isRole } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppLayout({
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

  const { data: org } = await supabase
    .from("organizations")
    .select("name, base_currency")
    .eq("id", membership.org_id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const t = await getTranslations("common");
  const role = isRole(membership.role) ? membership.role : "tenant";

  return (
    <AppShell
      orgName={org?.name ?? t("appName")}
      currency={org?.base_currency ?? t("currency")}
      role={role}
      userName={profile?.full_name ?? user.email?.split("@")[0] ?? ""}
      locale={locale}
    >
      {children}
    </AppShell>
  );
}
