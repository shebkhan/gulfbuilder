import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NotificationTemplateForm } from "@/components/domain/notification-template-form";
import { SendNowButton } from "@/components/domain/send-now-button";
import { SettingsNav } from "@/components/domain/settings-nav";
import { TelegramLinkCard } from "@/components/domain/telegram-link-card";
import { WebPushCard } from "@/components/domain/web-push-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { can, isRole } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/domain/page-header";

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

  const [{ data: templates }, { data: outbox }, { data: profile }, { count: queuedCount }, { count: sentCount }, { count: failedCount }] =
    await Promise.all([
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
      supabase
        .from("profiles")
        .select("telegram_chat_id, telegram_link_code, telegram_link_expires_at")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("notification_outbox")
        .select("id", { count: "exact", head: true })
        .eq("status", "queued"),
      supabase
        .from("notification_outbox")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent"),
      supabase
        .from("notification_outbox")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
    ]);

  const telegramCode =
    profile?.telegram_link_code &&
    profile.telegram_link_expires_at &&
    new Date(profile.telegram_link_expires_at) > new Date()
      ? profile.telegram_link_code
      : null;

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="settings"
        role={role}
        title={t("title")}
        description={t("subtitle")}
      />

      <SettingsNav />

      <TelegramLinkCard linked={Boolean(profile?.telegram_chat_id)} code={telegramCode} />

      <WebPushCard />

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
          <CardTitle>{t("health")}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          <p className="py-2 font-body-sm text-body-sm text-on-surface-variant">{t("healthHint")}</p>
          <dl className="grid grid-cols-3 gap-3">
            <div className="flex flex-col rounded-xl bg-surface-container-lowest p-3">
              <dt className="font-section-kicker text-section-kicker uppercase tracking-wider text-on-surface-variant">
                {t("queued")}
              </dt>
              <dd className="font-headline-md text-headline-md text-on-surface tabular">{queuedCount ?? 0}</dd>
            </div>
            <div className="flex flex-col rounded-xl bg-surface-container-lowest p-3">
              <dt className="font-section-kicker text-section-kicker uppercase tracking-wider text-on-surface-variant">
                {t("sent")}
              </dt>
              <dd className="font-headline-md text-headline-md text-on-surface tabular">{sentCount ?? 0}</dd>
            </div>
            <div className="flex flex-col rounded-xl bg-surface-container-lowest p-3">
              <dt className="font-section-kicker text-section-kicker uppercase tracking-wider text-on-surface-variant">
                {t("failed")}
              </dt>
              <dd className="font-headline-md text-headline-md text-on-surface tabular">{failedCount ?? 0}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("outbox")}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-4 pt-0">
          <SendNowButton />
          {!outbox || outbox.length === 0 ? (
            <p className="py-3 font-body-sm text-body-sm text-on-surface-variant">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-hairline" aria-live="polite">
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
