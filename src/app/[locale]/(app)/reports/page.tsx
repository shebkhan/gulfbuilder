import { AlertTriangle, Building2, DollarSign, TrendingUp } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ChequeView,
  CollectionView,
  ExpiryView,
  OccupancyView,
  ReportFilters,
} from "@/components/domain/report-parts";
import { StatementGenerator } from "@/components/domain/statement-generator";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, KpiLabel } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/rbac";
import {
  defaultReportFilters,
  fetchAgedReceivables,
  fetchChequeReport,
  fetchCollectionReport,
  fetchExpiryReport,
  fetchOccupancyReport,
  fetchPortfolioKpis,
  fetchReportBuildings,
  fetchRentRoll,
} from "@/server/actions/reports";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";

type SearchParams = Promise<{
  tab?: string;
  from?: string;
  to?: string;
  building?: string;
  page?: string;
}>;

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const { tab = "overview", from, to, building, page } = await searchParams;
  const filters = defaultReportFilters({ from, to, building });
  const t = await getTranslations("reports");
  const writable = can(ctx.role, "statements.write");

  // Fetch report data in parallel
  const [
    kpis,
    rentRoll,
    agedReceivables,
    { data: rawStatements },
    { data: rawOwners },
    { data: rawBankAccounts },
  ] = await Promise.all([
    fetchPortfolioKpis(),
    fetchRentRoll(),
    fetchAgedReceivables(),
    ctx.supabase
      .from("owner_statements")
      .select(
        `
          id,
          period_start,
          period_end,
          currency,
          status,
          closing_minor,
          totals,
          owners ( id, name )
        `,
      )
      .order("period_start", { ascending: false }),
    ctx.supabase.from("owners").select("id, name").order("name"),
    ctx.supabase.from("bank_accounts").select("id, name").order("name"),
  ]);

  const [reportBuildings, occupancyReport, expiryReport, collectionReport, chequeReport] =
    await Promise.all([
      fetchReportBuildings(),
      fetchOccupancyReport(filters),
      fetchExpiryReport(filters),
      fetchCollectionReport(filters),
      fetchChequeReport(filters),
    ]);

  const ownerOptions = (rawOwners || []).map((o) => ({ id: o.id, name: o.name }));
  const bankOptions = (rawBankAccounts || []).map((b) => ({ id: b.id, name: b.name }));

  const reportParams = {
    tab,
    from: filters.from,
    to: filters.to,
    building: filters.buildingId,
  };
  // next-intl's Link adds the locale prefix; the native GET form needs it explicitly.
  const reportHref = "/reports";
  const formAction = `/${locale}/reports`;

  const tabs = [
    { key: "overview", label: t("executiveSummary") },
    { key: "occupancy", label: t("occupancy") },
    { key: "expiry", label: t("expiry") },
    { key: "collections", label: t("collections") },
    { key: "cheques", label: t("cheques") },
    { key: "rent_roll", label: t("rentRoll") },
    { key: "aged_receivables", label: t("agedReceivables") },
    { key: "statements", label: t("statements") },
  ];

  const getAgingBadgeVariant = (bucket: string) => {
    switch (bucket) {
      case "90_plus":
        return "danger";
      case "61_90":
        return "danger";
      case "31_60":
        return "warning";
      default:
        return "info";
    }
  };

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="reports"
        role={ctx.role}
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-3">

        <StatementGenerator owners={ownerOptions} bankAccounts={bankOptions} writable={writable} />
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-fixed/40 text-primary">
              <Building2 className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("occupancyRate")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {kpis?.occupancy_pct ?? 0}%
              </span>
              <span className="text-xs text-on-surface-variant">
                {t("unitsSummary", { occupied: kpis?.occupied_units ?? 0, total: kpis?.total_units ?? 0 })}
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
              <KpiLabel>{t("monthlyRentRoll")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(BigInt(kpis?.monthly_rent_roll ?? 0), "QAR", locale)}
              </span>
              <span className="text-xs text-on-surface-variant">{t("kpis.activeAnnualizedPipeline")}</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-tertiary-fixed/40 text-tertiary">
              <DollarSign className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("netOperatingIncome")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(BigInt(kpis?.net_operating_income ?? 0), "QAR", locale)}
              </span>
              <span className="text-xs text-on-surface-variant">{t("kpis.collectionsLessExpenses")}</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-error-container text-error">
              <AlertTriangle className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("overdueReceivables")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(BigInt(kpis?.overdue_receivables ?? 0), "QAR", locale)}
              </span>
              <span className="text-xs text-on-surface-variant">{t("kpis.agedOutstanding")}</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline pb-2">
        {tabs.map((tb) => {
          const isActive = tab === tb.key;
          return (
            <Link
              key={tb.key}
              href={{
                pathname: "/reports",
                query: {
                  tab: tb.key,
                  from: filters.from,
                  to: filters.to,
                  ...(filters.buildingId ? { building: filters.buildingId } : {}),
                },
              }}
              className={`rounded-full px-4 py-1.5 font-label-md text-label-md transition-colors ${
                isActive
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {tb.label}
            </Link>
          );
        })}
      </div>

      <ReportFilters
        action={formAction}
        tab={tab}
        from={filters.from}
        to={filters.to}
        building={filters.buildingId}
        buildings={reportBuildings}
      />

      {tab === "occupancy" && occupancyReport ? (
        <OccupancyView report={occupancyReport} locale={locale} />
      ) : null}
      {tab === "expiry" && expiryReport ? (
        <ExpiryView
          report={expiryReport}
          locale={locale}
          page={Number(page ?? 1)}
          href={reportHref}
          params={reportParams}
        />
      ) : null}
      {tab === "collections" && collectionReport ? (
        <CollectionView report={collectionReport} locale={locale} />
      ) : null}
      {tab === "cheques" && chequeReport ? (
        <ChequeView
          report={chequeReport}
          locale={locale}
          page={Number(page ?? 1)}
          href={reportHref}
          params={reportParams}
        />
      ) : null}

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Quick Rent Roll Preview */}
          <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-container-lowest p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("rentRoll")}</h2>
              <Link href="/reports?tab=rent_roll" className="text-xs text-primary hover:underline">
                {t("viewAll")}
              </Link>
            </div>
            {rentRoll.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">
                {t("emptyRentRoll")}
              </p>
            ) : (
              <div className="divide-y divide-hairline">
                {rentRoll.slice(0, 5).map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium text-on-surface">
                        {r.building_code} — {t("unit")} {r.unit_no}
                      </span>
                      <span className="text-xs text-on-surface-variant">{r.tenant_name}</span>
                    </div>
                    <span className="font-semibold text-on-surface">
                      {formatMoney(BigInt(r.rent_minor), r.currency, locale)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Aged Receivables Preview */}
          <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-container-lowest p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                {t("agedReceivables")}
              </h2>
              <Link
                href="/reports?tab=aged_receivables"
                className="text-xs text-primary hover:underline"
              >
                {t("viewAll")}
              </Link>
            </div>
            {agedReceivables.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">
                {t("emptyReceivables")}
              </p>
            ) : (
              <div className="divide-y divide-hairline">
                {agedReceivables.slice(0, 5).map((a, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium text-on-surface">{a.tenant_name}</span>
                      <span className="text-xs text-on-surface-variant">
                        {t("overdueDue", { days: a.days_overdue, date: a.due_date })}
                      </span>
                    </div>
                    <span className="font-semibold text-error">
                      {formatMoney(BigInt(a.amount_minor), a.currency, locale)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rent Roll Tab */}
      {tab === "rent_roll" && (
        <div className="overflow-hidden rounded-xl border border-hairline bg-surface-container-lowest shadow-card">
          {rentRoll.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant">{t("emptyRentRoll")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-start font-body-sm text-body-sm">
                <thead>
                  <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                    <th className="p-4 text-start">{t("property")}</th>
                    <th className="p-4 text-start">{t("unit")}</th>
                    <th className="p-4 text-start">{t("tenant")}</th>
                    <th className="p-4 text-start">{t("lease")}</th>
                    <th className="p-4 text-start">{t("dates")}</th>
                    <th className="p-4 text-start">{t("status")}</th>
                    <th className="p-4 text-end">{t("rent")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {rentRoll.map((r, idx) => (
                    <tr key={idx} className="transition-colors hover:bg-surface-container-low/50">
                      <td className="p-4 font-medium text-on-surface">
                        {r.building_code} - {r.building_name}
                      </td>
                      <td className="p-4 text-on-surface">{r.unit_no}</td>
                      <td className="p-4 text-on-surface">{r.tenant_name}</td>
                      <td className="p-4 font-mono text-primary">{r.lease_no}</td>
                      <td className="p-4 text-on-surface-variant">
                        {r.start_date} {t("to")} {r.end_date}
                      </td>
                      <td className="p-4">
                        <Badge variant={r.status === "active" ? "success" : "neutral"}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-end font-semibold text-on-surface">
                        {formatMoney(BigInt(r.rent_minor), r.currency, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Aged Receivables Tab */}
      {tab === "aged_receivables" && (
        <div className="overflow-hidden rounded-xl border border-hairline bg-surface-container-lowest shadow-card">
          {agedReceivables.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant">{t("emptyReceivables")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-start font-body-sm text-body-sm">
                <thead>
                  <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                    <th className="p-4 text-start">{t("tenant")}</th>
                    <th className="p-4 text-start">{t("lease")}</th>
                    <th className="p-4 text-start">{t("overdueDays")}</th>
                    <th className="p-4 text-start">{t("bucket")}</th>
                    <th className="p-4 text-end">{t("amount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {agedReceivables.map((a, idx) => (
                    <tr key={idx} className="transition-colors hover:bg-surface-container-low/50">
                      <td className="p-4 font-medium text-on-surface">{a.tenant_name}</td>
                      <td className="p-4 font-mono text-primary">{a.lease_no}</td>
                      <td className="p-4 text-on-surface-variant">{a.days_overdue} {t("days")}</td>
                      <td className="p-4">
                        <Badge variant={getAgingBadgeVariant(a.bucket)}>
                          {a.bucket.replace("_", "-")} {t("days")}
                        </Badge>
                      </td>
                      <td className="p-4 text-end font-semibold text-error">
                        {formatMoney(BigInt(a.amount_minor), a.currency, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Statements Tab */}
      {tab === "statements" && (
        <div className="overflow-hidden rounded-xl border border-hairline bg-surface-container-lowest shadow-card">
          {!rawStatements || rawStatements.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant">{t("emptyStatements")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-start font-body-sm text-body-sm">
                <thead>
                  <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                    <th className="p-4 text-start">{t("owner")}</th>
                    <th className="p-4 text-start">{t("period")}</th>
                    <th className="p-4 text-start">{t("status")}</th>
                    <th className="p-4 text-end">{t("collections")}</th>
                    <th className="p-4 text-end">{t("expenses")}</th>
                    <th className="p-4 text-end">{t("managementFee")}</th>
                    <th className="p-4 text-end">{t("netPayable")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {rawStatements.map((s) => {
                    const owner = s.owners as unknown as { id: string; name: string } | null;
                    const totals = (s.totals || {}) as {
                      collections?: number;
                      expenses?: number;
                      management_fee?: number;
                      net_payable?: number;
                    };

                    return (
                      <tr
                        key={s.id}
                        className="transition-colors hover:bg-surface-container-low/50"
                      >
                        <td className="p-4 font-semibold text-on-surface">{owner?.name || "—"}</td>
                        <td className="p-4 text-on-surface-variant">
                          {s.period_start} {t("to")} {s.period_end}
                        </td>
                        <td className="p-4">
                          <Badge variant={s.status === "issued" ? "success" : "neutral"}>
                            {s.status === "issued" ? t("issued") : s.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-end text-on-surface">
                          {formatMoney(BigInt(totals.collections ?? 0), s.currency, locale)}
                        </td>
                        <td className="p-4 text-end text-error">
                          {formatMoney(BigInt(totals.expenses ?? 0), s.currency, locale)}
                        </td>
                        <td className="p-4 text-end text-on-surface-variant">
                          {formatMoney(BigInt(totals.management_fee ?? 0), s.currency, locale)}
                        </td>
                        <td className="p-4 text-end font-bold text-primary">
                          {formatMoney(BigInt(s.closing_minor), s.currency, locale)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
