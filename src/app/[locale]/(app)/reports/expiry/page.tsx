import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExpiryView, ReportFilters } from "@/components/domain/report-parts";
import { ReportsHeader } from "@/components/domain/reports/reports-header";
import {
  defaultReportFilters,
  fetchExpiryReport,
  fetchReportBuildings,
} from "@/server/actions/reports";
import { getOrgContext } from "@/server/org-context";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  building?: string;
  page?: string;
}>;

export default async function ExpiryReportPage({
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

  const { from, to, building, page } = await searchParams;
  const filters = defaultReportFilters({ from, to, building });
  const t = await getTranslations("reports");

  const [reportBuildings, expiryReport] = await Promise.all([
    fetchReportBuildings(),
    fetchExpiryReport(filters),
  ]);

  const reportHref = "/reports/expiry";
  const formAction = `/${locale}/reports/expiry`;
  const reportParams = {
    from: filters.from,
    to: filters.to,
    building: filters.buildingId,
  };

  return (
    <div className="flex flex-col gap-space-lg">
      <ReportsHeader
        locale={locale}
        role={ctx.role}
        title={t("expiry")}
        subtitle="Expiring leases within 30, 60, and 90 days, renewal status, and annualized pipeline exposure."
      />

      <ReportFilters
        action={formAction}
        tab="expiry"
        from={filters.from}
        to={filters.to}
        building={filters.buildingId}
        buildings={reportBuildings}
      />

      {expiryReport ? (
        <ExpiryView
          report={expiryReport}
          locale={locale}
          page={Number(page ?? 1)}
          href={reportHref}
          params={reportParams}
        />
      ) : null}
    </div>
  );
}

