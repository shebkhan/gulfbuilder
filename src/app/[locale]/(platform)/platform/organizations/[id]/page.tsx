import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  ImpersonateButton,
  OrganizationPlanForm,
  UsageSnapshotForm,
} from "@/components/domain/organization-admin-form";
import type { OrganizationSettings } from "@/components/domain/organization-settings-form";
import { PlatformLookupsManager, type LookupRow } from "@/components/domain/platform-lookups-manager";
import { PlatformOrgSettingsForm } from "@/components/domain/platform-org-settings-form";
import { PlatformTelegramForm } from "@/components/domain/platform-telegram-form";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LOOKUP_CATEGORIES } from "@/schemas/platform-admin";

export default async function PlatformOrganization({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("platform");

  const admin = createSupabaseAdminClient();
  const [org, subscription, plans, members, snapshots, lookups, integrations] = await Promise.all([
    admin.from("organizations").select("*").eq("id", id).maybeSingle(),
    admin.from("subscriptions").select("*").eq("org_id", id).maybeSingle(),
    admin.from("plans").select("*").order("code"),
    admin.from("org_members").select("user_id, role").eq("org_id", id),
    admin
      .from("usage_snapshots")
      .select("*")
      .eq("org_id", id)
      .order("taken_on", { ascending: false })
      .limit(12),
    admin
      .from("org_lookups")
      .select("id, category, code, label, sort_order, is_active")
      .eq("org_id", id)
      .order("category")
      .order("sort_order"),
    admin.from("org_integrations").select("config").eq("org_id", id).eq("provider", "telegram").maybeSingle(),
  ]);

  if (!org.data) notFound();

  const settings = (org.data.settings ?? {}) as Record<string, number | string>;
  const settingsValues: OrganizationSettings = {
    name: org.data.name ?? "",
    legalName: org.data.legal_name ?? "",
    taxId: org.data.tax_id ?? "",
    baseCurrency: org.data.base_currency ?? "QAR",
    defaultLocale: org.data.default_locale ?? "en",
    timezone: org.data.timezone ?? "Asia/Qatar",
    graceDays: Number(settings.grace_days ?? 0),
    lateFee: (Number(settings.late_fee_minor ?? 0) / 100).toFixed(2),
    lateFeeType: String(settings.late_fee_type ?? "flat"),
    lateFeePercent: Number(settings.late_fee_percent ?? 0),
    taxRate: Number(settings.tax_rate ?? 0),
    reminderDays: Number(settings.reminder_days ?? 0),
    revenueRecognition: String(settings.revenue_recognition ?? "on_due"),
  };
  const lookupRows: LookupRow[] = (lookups.data ?? []).map((row) => ({
    id: row.id,
    category: (LOOKUP_CATEGORIES as readonly string[]).includes(row.category)
      ? (row.category as LookupRow["category"])
      : LOOKUP_CATEGORIES[0],
    code: row.code,
    label: row.label,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  }));
  const telegramConfig =
    typeof integrations.data?.config === "object" && integrations.data.config
      ? (integrations.data.config as Record<string, unknown>)
      : {};

  const memberIds = (members.data ?? []).map((member) => member.user_id);
  const { data: profiles } = memberIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline-md text-headline-md text-on-surface">{org.data.name}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant" dir="ltr">
          {org.data.slug} · {org.data.status}
        </p>
      </div>

      <section className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
        <OrganizationPlanForm
          orgId={id}
          plans={(plans.data ?? []).map((plan) => ({ code: plan.code, name: plan.name ?? plan.code }))}
          current={{
            planCode: subscription.data?.plan_code ?? org.data.plan ?? null,
            status: subscription.data?.status ?? org.data.status ?? null,
            periodEnd: subscription.data?.period_end ?? null,
          }}
          currentFeatures={
            ((plans.data ?? []).find(
              (plan) => plan.code === (subscription.data?.plan_code ?? org.data.plan),
            )?.features ?? {}) as Record<string, boolean>
          }
        />
      </section>

      <section className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
        <h2 className="mb-4 font-headline-sm text-headline-sm text-on-surface">{t("members")}</h2>
        {(members.data ?? []).length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant">{t("emptyMembers")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-body-sm text-body-sm">
              <thead className="text-on-surface-variant">
                <tr className="border-b border-surface-container-high">
                  <th className="py-2 text-start font-medium">{t("member")}</th>
                  <th className="py-2 text-start font-medium">{t("role")}</th>
                  <th className="py-2 text-start font-medium">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {(members.data ?? []).map((member) => (
                  <tr key={member.user_id} className="border-b border-surface-container-low">
                    <td className="py-2">
                      {profileById.get(member.user_id)?.full_name ?? member.user_id}
                    </td>
                    <td className="py-2">{member.role}</td>
                    <td className="py-2">
                      <ImpersonateButton
                        orgId={id}
                        userId={member.user_id}
                        name={profileById.get(member.user_id)?.full_name ?? member.user_id}
                        locale={locale}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
        <h2 className="mb-4 font-headline-sm text-headline-sm text-on-surface">{t("usage.title")}</h2>
        {(snapshots.data ?? []).length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant">{t("usage.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-body-sm text-body-sm">
              <thead className="text-on-surface-variant">
                <tr className="border-b border-surface-container-high">
                  <th className="py-2 text-start font-medium">{t("usage.date")}</th>
                  <th className="py-2 text-start font-medium">{t("usage.units")}</th>
                  <th className="py-2 text-start font-medium">{t("usage.users")}</th>
                  <th className="py-2 text-start font-medium">{t("usage.storage")}</th>
                </tr>
              </thead>
              <tbody>
                {(snapshots.data ?? []).map((snapshot) => (
                  <tr key={snapshot.taken_on} className="border-b border-surface-container-low">
                    <td className="py-2">{snapshot.taken_on}</td>
                    <td className="py-2">{snapshot.units}</td>
                    <td className="py-2">{snapshot.users}</td>
                    <td className="py-2">{snapshot.storage_mb}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-5">
          <UsageSnapshotForm orgId={id} />
        </div>
      </section>

      <section className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
        <h2 className="mb-1 font-headline-sm text-headline-sm text-on-surface">
          {t("settings.title")}
        </h2>
        <PlatformOrgSettingsForm orgId={id} values={settingsValues} />
      </section>

      <section className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
        <h2 className="mb-4 font-headline-sm text-headline-sm text-on-surface">
          {t("lookups.title")}
        </h2>
        <PlatformLookupsManager orgId={id} rows={lookupRows} />
      </section>

      <section className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
        <h2 className="mb-4 font-headline-sm text-headline-sm text-on-surface">
          {t("telegram.title")}
        </h2>
        <PlatformTelegramForm
          orgId={id}
          config={{
            botToken: typeof telegramConfig.bot_token === "string" ? telegramConfig.bot_token : "",
            botName: typeof telegramConfig.bot_name === "string" ? telegramConfig.bot_name : "",
            chatId: typeof telegramConfig.chat_id === "string" ? telegramConfig.chat_id : "",
            enabled: telegramConfig.enabled === true,
          }}
        />
      </section>
    </div>
  );
}
