import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { InviteForm } from "@/components/domain/invite-form";
import { can, isRole } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const INVITABLE_ROLES = ["manager", "accountant", "caretaker", "owner", "tenant"] as const;

export default async function UsersSettingsPage({
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
    .select("role")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const role = membership && isRole(membership.role) ? membership.role : "tenant";
  if (!can(role, "settings.write")) redirect(`/${locale}/dashboard`);

  const t = await getTranslations("settings.users");

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <p className="max-w-xl font-body-md text-body-md text-on-surface-variant">
          {t("subtitle")}
        </p>
      </div>

      <InviteForm
        locale={locale}
        labels={{
          email: t("email"),
          role: t("role"),
          invite: t("invite"),
          sending: t("sending"),
          invited: t("invited"),
          errors: t.raw("errors") as Record<string, string>,
        }}
        roles={INVITABLE_ROLES.map((value) => ({ value, label: t(`roles.${value}`) }))}
      />
    </div>
  );
}
