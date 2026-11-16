import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NotificationTemplateForm } from "@/components/domain/notification-template-form";
import { SettingsNav } from "@/components/domain/settings-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { can, isRole } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function NotificationSettingsPage({
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

  const t = await getTranslations("settings.notifications");

  const [{ data: templates }, { data: outbox }] = await Promise.all([
    supabase
      .from("notification_templates")
      .select("id, event, channel, locale, subject, body")
      .order("event")
      .limit(100),
    supabase
      .from("notification_outbox")
      .select("id, event, channel, recipient, locale, status, attempts, created_at, sent_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <p className="max-w-xl font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
      </div>

      <SettingsNav />

      <NotificationTemplateForm />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("templates")}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {!templates || templates.length === 0 ? (
            <p className="py-3 font-body-sm text-body-sm text-on-surface-variant">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {templates.map((template) => (
                <li key={template.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="flex flex-col">
                    <span className="font-body-md text-body-md font-medium text-on-surface">
                      {template.event}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      {template.subject ?? template.body.slice(0, 80)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{template.channel}</Badge>
                    <Badge variant="neutral">{template.locale}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("outbox")}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {!outbox || outbox.length === 0 ? (
            <p className="py-3 font-body-sm text-body-sm text-on-surface-variant">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {outbox.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="flex flex-col">
                    <span className="font-body-md text-body-md font-medium text-on-surface">
                      {row.event}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      {row.recipient} · {row.channel} · {new Date(row.created_at).toLocaleString(locale)}
                    </span>
                  </div>
                  <Badge variant={row.status === "sent" ? "success" : "warning"}>{row.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
