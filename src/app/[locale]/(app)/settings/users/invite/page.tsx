import { ArrowLeft, ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { InviteForm } from "@/components/domain/invite-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can, isRole } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const INVITABLE_ROLES = ["manager", "accountant", "caretaker", "owner", "tenant"] as const;

export default async function InviteUserPage({
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
  const tc = await getTranslations("common");
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex items-center gap-3">
        <Link
          href="/settings/users"
          className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
        >
          <BackIcon className="h-4 w-4" />
          <span>{tc("back")}</span>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("invite")}</CardTitle>
        </CardHeader>
        <CardBody>
          <InviteForm
            locale={locale}
            labels={{
              email: t("email"),
              role: t("role"),
              invite: t("invite"),
              sending: t("sending"),
              invited: t.raw("invited") as string,
              errors: t.raw("errors") as Record<string, string>,
            }}
            roles={INVITABLE_ROLES.map((value) => ({ value, label: t(`roles.${value}`) }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}
