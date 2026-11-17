import { getTranslations, setRequestLocale } from "next-intl/server";
import { CollectionView, ReportFilters } from "@/components/domain/report-parts";
import { ReportsHeader } from "@/components/domain/reports/reports-header";
import {
  defaultReportFilters,
  fetchCollectionReport,
  fetchReportBuildings,
} from "@/server/actions/reports";
import { getOrgContext } from "@/server/org-context";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  building?: string;
}>;

export default async function CollectionsReportPage({
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

  const [reportBuildings, collectionReport] = await Promise.all([
    fetchReportBuildings(),
    fetchCollectionReport(filters),
  ]);

  const formAction = `/${locale}/reports/collections`;

  return (
    <div className="flex flex-col gap-space-lg">
      <ReportsHeader
        locale={locale}
        role={ctx.role}
        title={t("collections")}
        subtitle="Billed amounts versus collected payments and overall portfolio collection efficiency."
      />

      <ReportFilters
        action={formAction}
        tab="collections"
        from={filters.from}
        to={filters.to}
        building={filters.buildingId}
        buildings={reportBuildings}
      />

      {collectionReport ? <CollectionView report={collectionReport} locale={locale} /> : null}
    </div>
  );
}
