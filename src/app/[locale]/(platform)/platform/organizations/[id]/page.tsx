import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  ImpersonateButton,
  OrganizationPlanForm,
  UsageSnapshotForm,
} from "@/components/domain/organization-admin-form";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function PlatformOrganization({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("platform");

  const admin = createSupabaseAdminClient();
  const [org, subscription, plans, members, snapshots] = await Promise.all([
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
  ]);

  if (!org.data) notFound();

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
    </div>
  );
}
