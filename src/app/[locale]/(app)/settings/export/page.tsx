import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExportButtons } from "@/components/domain/export-buttons";
import { SettingsNav } from "@/components/domain/settings-nav";
import { can, isRole } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ExportSettingsPage({
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

  const t = await getTranslations("settings.export");

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <p className="max-w-xl font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
      </div>

      <SettingsNav />

      <ExportButtons />
    </div>
  );
}
