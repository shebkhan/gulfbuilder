import { LogOut } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { LocaleSwitcher } from "@/components/domain/locale-switcher";
import { Button } from "@/components/ui/button";
import { PortalBottomNav } from "@/components/domain/portal-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBrand } from "@/lib/white-label";
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
  const logoUrl = (await getBrand())?.logoUrl;

  return (
    <div className="auth-backdrop min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-hairline bg-surface-container-lowest px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl ?? "/icons/icon.svg"} alt="" className="size-7 shrink-0 object-contain" />
            <span className="truncate font-headline-sm text-headline-sm font-semibold text-on-surface">
              {org?.name ?? t("appName")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <form action={signOutAction}>
              <input type="hidden" name="locale" value={locale} />
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                title={t("signOut")}
                aria-label={t("signOut")}
              >
                <LogOut />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4 pb-28">{children}</main>

      <PortalBottomNav />
    </div>
  );
}
