import { getTranslations, setRequestLocale } from "next-intl/server";
import { OccupancyView, ReportFilters } from "@/components/domain/report-parts";
import { ReportsHeader } from "@/components/domain/reports/reports-header";
import {
  defaultReportFilters,
  fetchOccupancyReport,
  fetchReportBuildings,
} from "@/server/actions/reports";
import { getOrgContext } from "@/server/org-context";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  building?: string;
}>;

export default async function OccupancyReportPage({
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

  const { from, to, building } = await searchParams;
  const filters = defaultReportFilters({ from, to, building });
  const t = await getTranslations("reports");

  const [reportBuildings, occupancyReport] = await Promise.all([
    fetchReportBuildings(),
    fetchOccupancyReport(filters),
  ]);

  const formAction = `/${locale}/reports/occupancy`;

  return (
    <div className="flex flex-col gap-space-lg">
      <ReportsHeader
        locale={locale}
        role={ctx.role}
        title={t("occupancy")}
        subtitle="Portfolio occupancy rate, vacant units breakdown, gross potential rent, and vacancy loss."
      />

      <ReportFilters
        action={formAction}
        tab="occupancy"
        from={filters.from}
        to={filters.to}
        building={filters.buildingId}
        buildings={reportBuildings}
      />

      {occupancyReport ? <OccupancyView report={occupancyReport} locale={locale} /> : null}
    </div>
  );
}
