import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  ChequeView,
  CollectionView,
  ExpiryView,
  OccupancyView,
  ReportFilters,
} from "@/components/domain/report-parts";
import {
  defaultReportFilters,
  fetchChequeReport,
  fetchCollectionReport,
  fetchExpiryReport,
  fetchOccupancyReport,
  fetchReportBuildings,
} from "@/server/actions/reports";
import { getOwnerScope } from "@/server/queries/owner-portal";

type SearchParams = Promise<{
  tab?: string;
  from?: string;
  to?: string;
  building?: string;
  page?: string;
}>;

/** Owner portal (SPEC §8 O1): the same four portfolio reports, scoped by RLS. */
export default async function OwnerReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const scope = await getOwnerScope();
  if (!scope) return null;

  const { tab = "occupancy", from, to, building, page } = await searchParams;
  const filters = defaultReportFilters({ from, to, building });
  const t = await getTranslations("reports");

  const [buildings, occupancy, expiry, collection, cheques] = await Promise.all([
    fetchReportBuildings(),
    fetchOccupancyReport(filters),
    fetchExpiryReport(filters),
    fetchCollectionReport(filters),
    fetchChequeReport(filters),
  ]);

  const reportHref = "/owner/reports";
  const reportParams = {
    tab,
    from: filters.from,
    to: filters.to,
    ...(filters.buildingId ? { building: filters.buildingId } : {}),
  };

  const tabs = [
    { key: "occupancy", label: t("occupancy") },
    { key: "expiry", label: t("expiry") },
    { key: "collections", label: t("collections") },
    { key: "cheques", label: t("cheques") },
  ];

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("ownerSubtitle")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-hairline pb-2">
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={{
              pathname: "/owner/reports",
              query: {
                tab: item.key,
                from: filters.from,
                to: filters.to,
                ...(reportParams.building ? { building: reportParams.building } : {}),
              },
            }}
            className={`rounded-full px-4 py-1.5 font-label-md text-label-md transition-colors ${
              tab === item.key
                ? "bg-primary text-on-primary"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <ReportFilters
        action={`/${locale}/owner/reports`}
        tab={tab}
        from={filters.from}
        to={filters.to}
        building={filters.buildingId}
        buildings={buildings.filter((b) => scope.buildingIds.includes(b.id))}
      />

      {tab === "occupancy" && occupancy ? (
        <OccupancyView report={occupancy} locale={locale} />
      ) : null}
      {tab === "expiry" && expiry ? (
        <ExpiryView
          report={expiry}
          locale={locale}
          page={Number(page ?? 1)}
          href={reportHref}
          params={reportParams}
        />
      ) : null}
      {tab === "collections" && collection ? (
        <CollectionView report={collection} locale={locale} />
      ) : null}
      {tab === "cheques" && cheques ? (
        <ChequeView
          report={cheques}
          locale={locale}
          page={Number(page ?? 1)}
          href={reportHref}
          params={reportParams}
        />
      ) : null}
    </div>
  );
}
