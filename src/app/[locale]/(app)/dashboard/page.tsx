import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  CreditCard,
  DollarSign,
  FileSignature,
  Receipt,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle, KpiLabel } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/rbac";
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

  const next30Days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  // Parallel data fetching for entire dashboard
  const [
    kpis,
    { data: rawExpiring },
    { count: openMaintCount },
    { data: rawCheques },
    { data: rawPayments },
    { data: rawMaintRequests },
    { data: rawBuildings },
  ] = await Promise.all([
    fetchPortfolioKpis(),
    ctx.supabase.rpc("leases_expiring", { p_days: 30 }),
    ctx.supabase
      .from("maintenance_requests")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "in_progress"]),
    ctx.supabase
      .from("cheques")
      .select("id, cheque_no, bank_name, amount_minor, currency, cheque_date, status, tenants(full_name)")
      .in("status", ["received", "deposited"])
      .lte("cheque_date", next30Days)
      .order("cheque_date", { ascending: true })
      .limit(4),
    ctx.supabase
      .from("payments")
      .select("id, receipt_no, receipt_year, amount_minor, currency, method, received_at, tenants(full_name)")
      .order("received_at", { ascending: false })
      .limit(4),
    ctx.supabase
      .from("maintenance_requests")
      .select("id, title, priority, status, opened_at, buildings(code), units(unit_no)")
      .in("status", ["open", "in_progress"])
      .order("opened_at", { ascending: false })
      .limit(4),
    ctx.supabase
      .from("buildings")
      .select("id, code, name, units(id, status)")
      .is("deleted_at", null)
      .order("code"),
  ]);

  const expiringLeases = (rawExpiring ?? []) as {
    lease_id: string;
    lease_no: string;
    tenant_name: string;
    end_date: string;
    days_left: number;
  }[];

  const canLease = can(ctx.role, "leases.write");
  const canFinance = can(ctx.role, "finance.write") || ctx.role === "manager";
  const canMaint = can(ctx.role, "maintenance.write");

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "danger";
      case "high":
        return "warning";
      case "normal":
        return "info";
      default:
        return "neutral";
    }
  };

  return (
    <div className="flex flex-col gap-6 pt-2">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{t("empty")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canFinance && (
            <Link
              href="/payments"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container hover:text-on-primary-container"
            >
              <CreditCard className="size-4" />
              <span>{t("recordPayment")}</span>
            </Link>
          )}
          {canLease && (
            <Link
              href="/leases/new"
              className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-container-low px-4 py-2 font-label-md text-label-md text-on-surface hover:bg-surface-container-high"
            >
              <FileSignature className="size-4" />
              <span>{t("newLease")}</span>
            </Link>
          )}
          {canMaint && (
            <Link
              href="/maintenance"
              className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-container-low px-4 py-2 font-label-md text-label-md text-on-surface hover:bg-surface-container-high"
            >
              <Wrench className="size-4" />
              <span>{t("newMaintenance")}</span>
            </Link>
          )}
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-container-low px-4 py-2 font-label-md text-label-md text-on-surface hover:bg-surface-container-high"
          >
            <span>{t("viewReports")}</span>
          </Link>
        </div>
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
              <span className="text-xs text-on-surface-variant">YTD collections less expenses</span>
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

      {/* Main Two-Column Dashboard Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column: Leasing & Finance Alerts */}
        <div className="flex flex-col gap-6">
          {/* Expiring Leases Alert Card */}
          {expiringLeases && expiringLeases.length > 0 && (
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
                  {expiringLeases.slice(0, 4).map((lease) => (
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
          )}

          {/* Cheques Maturing Soon */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-secondary" />
                <CardTitle className="text-title-md">{t("upcomingCheques")}</CardTitle>
              </div>
              <Link
                href="/cheques"
                className="flex items-center gap-1 font-label-md text-label-md text-primary hover:underline underline-offset-4"
              >
                <span>{t("viewAll")}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardHeader>
            <CardBody className="pt-0">
              {(!rawCheques || rawCheques.length === 0) ? (
                <p className="py-4 font-body-sm text-body-sm text-on-surface-variant">
                  {t("noUpcomingCheques")}
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-hairline">
                  {rawCheques.map((c) => {
                    const tenant = c.tenants as unknown as { full_name: string } | null;
                    return (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-3"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-on-surface">
                            Cheque #{c.cheque_no} ({c.bank_name})
                          </span>
                          <span className="text-xs text-on-surface-variant">
                            {tenant?.full_name} · Due {c.cheque_date}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={c.status === "deposited" ? "warning" : "info"}>
                            {c.status}
                          </Badge>
                          <span className="font-semibold text-on-surface">
                            {formatMoney(BigInt(c.amount_minor), c.currency, locale)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Recent Collections Feed */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                <CardTitle className="text-title-md">{t("recentPayments")}</CardTitle>
              </div>
              <Link
                href="/payments"
                className="flex items-center gap-1 font-label-md text-label-md text-primary hover:underline underline-offset-4"
              >
                <span>{t("viewAll")}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardHeader>
            <CardBody className="pt-0">
              {(!rawPayments || rawPayments.length === 0) ? (
                <p className="py-4 font-body-sm text-body-sm text-on-surface-variant">
                  {t("noRecentPayments")}
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-hairline">
                  {rawPayments.map((p) => {
                    const tenant = p.tenants as unknown as { full_name: string } | null;
                    const receiptFormatted = `#${p.receipt_year}-${String(p.receipt_no).padStart(4, "0")}`;
                    return (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-3"
                      >
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-semibold text-primary">
                            {receiptFormatted}
                          </span>
                          <span className="text-xs text-on-surface-variant">
                            {tenant?.full_name} · {p.method}
                          </span>
                        </div>
                        <span className="font-semibold text-on-surface">
                          {formatMoney(BigInt(p.amount_minor), p.currency, locale)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Operations & Portfolio Breakdown */}
        <div className="flex flex-col gap-6">
          {/* Building Occupancy Breakdown */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-title-md">{t("buildingsOccupancy")}</CardTitle>
              </div>
              <Link
                href="/buildings"
                className="flex items-center gap-1 font-label-md text-label-md text-primary hover:underline underline-offset-4"
              >
                <span>{t("viewAll")}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardHeader>
            <CardBody className="pt-0">
              {(!rawBuildings || rawBuildings.length === 0) ? (
                <p className="py-4 font-body-sm text-body-sm text-on-surface-variant">
                  No buildings created.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-hairline">
                  {rawBuildings.map((b) => {
                    const unitsList = (b.units || []) as { id: string; status: string }[];
                    const totalU = unitsList.length;
                    const occupiedU = unitsList.filter((u) => u.status === "occupied").length;
                    const pct = totalU > 0 ? Math.round((occupiedU / totalU) * 100) : 0;

                    return (
                      <div key={b.id} className="flex flex-col gap-2 py-3">
                        <div className="flex items-center justify-between text-sm">
                          <Link
                            href={`/buildings/${b.id}`}
                            className="font-medium text-on-surface hover:text-primary hover:underline"
                          >
                            {b.code} — {b.name}
                          </Link>
                          <span className="font-semibold text-on-surface">
                            {pct}% ({occupiedU}/{totalU})
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Active Maintenance Work Orders */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-error" />
                <CardTitle className="text-title-md">{t("recentMaintenance")}</CardTitle>
              </div>
              <Link
                href="/maintenance"
                className="flex items-center gap-1 font-label-md text-label-md text-primary hover:underline underline-offset-4"
              >
                <span>{t("viewAll")}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardHeader>
            <CardBody className="pt-0">
              {(!rawMaintRequests || rawMaintRequests.length === 0) ? (
                <p className="py-4 font-body-sm text-body-sm text-on-surface-variant">
                  {t("noRecentMaintenance")}
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-hairline">
                  {rawMaintRequests.map((req) => {
                    const building = req.buildings as unknown as { code: string } | null;
                    const unit = req.units as unknown as { unit_no: string } | null;
                    const location = [building?.code, unit?.unit_no ? `Unit ${unit.unit_no}` : "Common Area"]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <div
                        key={req.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-3"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-on-surface">{req.title}</span>
                          <span className="text-xs text-on-surface-variant">{location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getPriorityVariant(req.priority)}>
                            {req.priority}
                          </Badge>
                          <Badge variant={req.status === "in_progress" ? "info" : "neutral"}>
                            {req.status.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
