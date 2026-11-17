import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/domain/app-shell";
import { PLATFORM_NAV } from "@/components/domain/nav-items";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Platform console (SPEC §8): platform_admin only, no organization membership required. */
export default async function PlatformLayout({
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

  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) redirect(`/${locale}/dashboard`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const t = await getTranslations();

  return (
    <AppShell
      orgName={t("platform.title")}
      currency={t("common.currency")}
      role="platform_admin"
      userName={profile?.full_name ?? user.email?.split("@")[0] ?? ""}
      locale={locale}
      items={PLATFORM_NAV}
      footerItems={[]}
    >
      {children}
    </AppShell>
  );
}
