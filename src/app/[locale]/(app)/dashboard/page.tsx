import {
  AlertTriangle,
  ArrowRight,
  Building2,
  DollarSign,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle, KpiLabel } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { fetchPortfolioKpis } from "@/server/actions/reports";
import { getOrgContext } from "@/server/org-context";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const t = await getTranslations("dashboard");

  // Fetch KPI data, expiring leases, and open maintenance requests in parallel
  const [kpis, { data: rawExpiring }, { count: openMaintCount }] = await Promise.all([
    fetchPortfolioKpis(),
    ctx.supabase.rpc("leases_expiring", { p_days: 30 }),
    ctx.supabase
      .from("maintenance_requests")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "in_progress"]),
  ]);

  const expiringLeases = (rawExpiring ?? []) as {
    lease_id: string;
    lease_no: string;
    tenant_name: string;
    end_date: string;
    days_left: number;
  }[];

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Portfolio overview, operational alerts, and financial performance.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-fixed/40 text-primary">
              <Building2 className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>Occupancy</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {kpis?.occupancy_pct ?? 0}%
              </span>
              <span className="text-xs text-on-surface-variant">
                {kpis?.occupied_units ?? 0} / {kpis?.total_units ?? 0} units
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-secondary-container/60 text-secondary">
              <TrendingUp className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>Monthly Rent Roll</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(BigInt(kpis?.monthly_rent_roll ?? 0), "QAR", locale)}
              </span>
              <span className="text-xs text-on-surface-variant">Active lease pipeline</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-tertiary-fixed/40 text-tertiary">
              <DollarSign className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>Net Operating Income</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(BigInt(kpis?.net_operating_income ?? 0), "QAR", locale)}
              </span>
              <span className="text-xs text-on-surface-variant">YTD revenue less expenses</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-error-container text-error">
              <Wrench className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>Active Work Orders</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {openMaintCount ?? 0}
              </span>
              <span className="text-xs text-on-surface-variant">
                <Link href="/maintenance" className="underline hover:text-on-surface">
                  View queue
                </Link>
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Expiring Leases Alert Card */}
      {expiringLeases && expiringLeases.length > 0 ? (
        <Card className="border-primary/20 bg-surface-container-lowest">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <CardTitle className="text-title-md">{t("expiringLeases")}</CardTitle>
            </div>
            <Link
              href="/leases?expiring=true"
              className="flex items-center gap-1 font-label-md text-label-md text-primary hover:underline underline-offset-4"
            >
              <span>{t("viewAll")}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardBody className="pt-0">
            <p className="mb-4 font-body-sm text-body-sm text-on-surface-variant">
              {t("expiringSubtitle")}
            </p>
            <div className="flex flex-col divide-y divide-hairline">
              {expiringLeases.map((lease) => (
                <div
                  key={lease.lease_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="flex flex-col">
                    <Link
                      href={`/leases/${lease.lease_id}`}
                      className="font-label-lg text-label-lg font-semibold text-on-surface hover:text-primary hover:underline underline-offset-4"
                    >
                      {lease.lease_no}
                    </Link>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      {lease.tenant_name} · Ends {lease.end_date}
                    </span>
                  </div>

                  <Badge variant={lease.days_left <= 7 ? "danger" : "warning"}>
                    {t("daysLeft", { days: lease.days_left })}
                  </Badge>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
