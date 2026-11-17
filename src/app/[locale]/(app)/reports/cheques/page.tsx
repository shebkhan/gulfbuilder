import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChequeView, ReportFilters } from "@/components/domain/report-parts";
import { ReportsHeader } from "@/components/domain/reports/reports-header";
import {
  defaultReportFilters,
  fetchChequeReport,
  fetchReportBuildings,
} from "@/server/actions/reports";
import { getOrgContext } from "@/server/org-context";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  building?: string;
  page?: string;
}>;

export default async function ChequesReportPage({
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

  const [reportBuildings, chequeReport] = await Promise.all([
    fetchReportBuildings(),
    fetchChequeReport(filters),
  ]);

  const reportHref = "/reports/cheques";
  const formAction = `/${locale}/reports/cheques`;
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
        title={t("cheques")}
        subtitle="Post-dated cheque lifecycle, upcoming deposits, cleared cheques, and return tracking."
      />

      <ReportFilters
        action={formAction}
        tab="cheques"
        from={filters.from}
        to={filters.to}
        building={filters.buildingId}
        buildings={reportBuildings}
      />

      {chequeReport ? (
        <ChequeView
          report={chequeReport}
          locale={locale}
          page={Number(page ?? 1)}
          href={reportHref}
          params={reportParams}
        />
      ) : null}
    </div>
  );
}
