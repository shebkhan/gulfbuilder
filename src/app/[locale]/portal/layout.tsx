import { LogOut } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { LocaleSwitcher } from "@/components/domain/locale-switcher";
import { PortalBottomNav } from "@/components/domain/portal-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOutAction } from "@/server/actions/auth";

/** Tenant portal (SPEC §8 T1). Mobile-first, own data only. */
export default async function PortalLayout({
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
  if (membership.role !== "tenant") redirect(`/${locale}/dashboard`);

  const { data: enabled } = await supabase.rpc("org_feature_enabled", {
    p_org: membership.org_id,
    p_feature: "tenant_portal",
  });
  if (enabled === false) redirect(`/${locale}/dashboard`);

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", membership.org_id)
    .maybeSingle();

  const t = await getTranslations("common");

  return (
    <div className="min-h-dvh bg-surface-container-low">
      <header className="sticky top-0 z-40 border-b border-hairline bg-surface-container-lowest px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <span className="truncate font-headline-sm text-headline-sm font-semibold text-on-surface">
            {org?.name ?? t("appName")}
          </span>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <form action={signOutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                title={t("signOut")}
                aria-label={t("signOut")}
                className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                <LogOut className="size-[18px]" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4 pb-28">{children}</main>

      <PortalBottomNav />
    </div>
  );
}
