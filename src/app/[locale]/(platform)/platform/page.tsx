import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreateOrganizationForm } from "@/components/domain/organization-admin-form";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { EmptyState } from "@/components/domain/empty-state";

export default async function PlatformDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("platform");

  const admin = createSupabaseAdminClient();
  const [orgs, subscriptions, plans, units, snapshots] = await Promise.all([
    admin
      .from("organizations")
      .select("id, name, slug, status, plan, base_currency, created_at")
      .order("created_at", { ascending: false }),
    admin.from("subscriptions").select("org_id, plan_code, status, period_end"),
    admin.from("plans").select("code, name, price_minor, currency"),
    admin.from("units").select("org_id"),
    admin
      .from("usage_snapshots")
      .select("org_id, taken_on, units, users, storage_mb")
      .order("taken_on", { ascending: false }),
  ]);

  const planByCode = new Map((plans.data ?? []).map((plan) => [plan.code, plan]));
  const subByOrg = new Map((subscriptions.data ?? []).map((sub) => [sub.org_id, sub]));
  const unitCount = new Map<string, number>();
  for (const unit of units.data ?? []) {
    unitCount.set(unit.org_id, (unitCount.get(unit.org_id) ?? 0) + 1);
  }
  const latestUsage = new Map<string, { units: number; users: number; storage_mb: number }>();
  for (const snapshot of snapshots.data ?? []) {
    if (!latestUsage.has(snapshot.org_id)) {
      latestUsage.set(snapshot.org_id, snapshot);
    }
  }

  const totals = [...latestUsage.values()].reduce(
    (acc, usage) => ({
      units: acc.units + usage.units,
      users: acc.users + usage.users,
      storage: acc.storage + usage.storage_mb,
    }),
    { units: 0, users: 0, storage: 0 },
  );
  const mrr = new Map<string, bigint>();
  for (const sub of subscriptions.data ?? []) {
    if (sub.status !== "active") continue;
    const plan = sub.plan_code ? planByCode.get(sub.plan_code) : null;
    const currency = plan?.currency ?? "QAR";
    mrr.set(currency, (mrr.get(currency) ?? 0n) + BigInt(plan?.price_minor ?? 0));
  }
  const mrrLabel =
    [...mrr].map(([currency, amount]) => formatMoney(amount, currency, locale)).join(" · ") || "0";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline-md text-headline-md text-on-surface">{t("title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
          <span className="font-section-kicker text-[10px] uppercase tracking-widest text-on-surface-variant">
            {t("summary.organizations")}
          </span>
          <p className="font-metric-num-lg text-on-surface">{(orgs.data ?? []).length}</p>
        </div>
        <div className="rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
          <span className="font-section-kicker text-[10px] uppercase tracking-widest text-on-surface-variant">
            {t("summary.mrr")}
          </span>
          <p className="font-metric-num-lg text-on-surface">{mrrLabel}</p>
        </div>
        <div className="rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
          <span className="font-section-kicker text-[10px] uppercase tracking-widest text-on-surface-variant">
            {t("summary.units")}
          </span>
          <p className="font-metric-num-lg text-on-surface">{totals.units}</p>
        </div>
        <div className="rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
          <span className="font-section-kicker text-[10px] uppercase tracking-widest text-on-surface-variant">
            {t("summary.users")}
          </span>
          <p className="font-metric-num-lg text-on-surface">{totals.users}</p>
        </div>
      </div>

      <section className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
        <h2 className="mb-4 font-headline-sm text-headline-sm text-on-surface">{t("organizations")}</h2>
        {(orgs.data ?? []).length === 0 ? (
          <EmptyState animation="/animations/empty-box.lottie" description={t("empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start font-body-sm text-body-sm">
              <thead className="text-on-surface-variant">
                <tr className="border-b border-surface-container-high">
                  <th className="py-2 text-start font-medium">{t("orgName")}</th>
                  <th className="py-2 text-start font-medium">{t("orgSlug")}</th>
                  <th className="py-2 text-start font-medium">{t("plan.plan")}</th>
                  <th className="py-2 text-start font-medium">{t("plan.status")}</th>
                  <th className="py-2 text-start font-medium">{t("summary.units")}</th>
                  <th className="py-2 text-start font-medium">{t("summary.mrr")}</th>
                </tr>
              </thead>
              <tbody>
                {(orgs.data ?? []).map((org) => {
                  const sub = subByOrg.get(org.id);
                  const plan = sub?.plan_code ? planByCode.get(sub.plan_code) : null;
                  return (
                    <tr key={org.id} className="border-b border-surface-container-low">
                      <td className="py-2">
                        <Link
                          href={`/platform/organizations/${org.id}`}
                          className="font-medium text-primary underline"
                        >
                          {org.name}
                        </Link>
                      </td>
                      <td className="py-2" dir="ltr">
                        {org.slug}
                      </td>
                      <td className="py-2">{plan?.name ?? sub?.plan_code ?? org.plan}</td>
                      <td className="py-2">{sub?.status ?? org.status}</td>
                      <td className="py-2">{unitCount.get(org.id) ?? 0}</td>
                      <td className="py-2">
                        {formatMoney(BigInt(sub?.status === "active" ? (plan?.price_minor ?? 0) : 0), plan?.currency ?? "QAR", locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
        <CreateOrganizationForm />
      </section>
    </div>
  );
}
