import { ClipboardCheck, Clock } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { InspectionList, type InspectionItem } from "@/components/domain/inspection-form";
import { ListPagination } from "@/components/domain/list-pagination";
import { Card, CardBody, KpiLabel } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { PAGE_SIZE, getPaginationRange, toPaginated } from "@/lib/pagination";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";

type SearchParams = Promise<{
  kind?: string;
  page?: string;
}>;

export default async function InspectionsPage({
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

  const { kind, page } = await searchParams;
  const t = await getTranslations("inspections");
  const tCommon = await getTranslations("common");
  const writable = can(ctx.role, "maintenance.write");

  const currentPage = Math.max(1, Number(page ?? 1));
  const { from, to } = getPaginationRange(currentPage, PAGE_SIZE);

  let aggregateQuery = ctx.supabase.from("inspections").select("kind, completed_at");
  let pageQuery = ctx.supabase
    .from("inspections")
    .select(
      `
      id,
      kind,
      data,
      completed_at,
      tenant_signed,
      notes,
      created_at,
      leases (
        id,
        lease_no,
        tenants ( id, full_name )
      )
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (kind && kind !== "all") {
    aggregateQuery = aggregateQuery.eq("kind", kind);
    pageQuery = pageQuery.eq("kind", kind);
  }

  const [{ data: allInspections }, { data: inspections, count }] = await Promise.all([
    aggregateQuery,
    pageQuery.range(from, to),
  ]);

  const aggregateRows = allInspections ?? [];
  const moveInCount = aggregateRows.filter((i) => i.kind === "move_in").length;
  const moveOutCount = aggregateRows.filter((i) => i.kind === "move_out").length;
  const pendingCount = aggregateRows.filter((i) => !i.completed_at).length;

  const transformedInspections: InspectionItem[] = (inspections ?? []).map((i) => {
    const leaseData = i.leases as unknown as {
      id: string;
      lease_no: string;
      tenants: { id: string; full_name: string } | null;
    } | null;

    return {
      id: i.id,
      kind: i.kind as InspectionItem["kind"],
      data: (i.data || {}) as Record<string, unknown>,
      completed_at: i.completed_at,
      tenant_signed: i.tenant_signed,
      notes: i.notes,
      created_at: i.created_at,
      lease: leaseData
        ? {
            id: leaseData.id,
            lease_no: leaseData.lease_no,
            tenant: leaseData.tenants,
          }
        : null,
    };
  });

  const filterTabs = [
    { key: "all", label: tCommon("all") },
    { key: "move_in", label: t("moveIn") },
    { key: "move_out", label: t("moveOut") },
  ];

  const paged = toPaginated(transformedInspections, count, currentPage);

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="inspections"
        role={ctx.role}
        title={t("title")}
        description={t("subtitle")}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-fixed/40 text-primary">
              <ClipboardCheck className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("kpis.moveInSurveys")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {moveInCount}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-tertiary-fixed/40 text-tertiary">
              <ClipboardCheck className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("kpis.moveOutSurveys")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {moveOutCount}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-secondary-container/60 text-secondary">
              <Clock className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("kpis.pendingCompletion")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {pendingCount}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline pb-2">
        {filterTabs.map((tab) => {
          const isActive = (!kind && tab.key === "all") || kind === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.key === "all" ? "/inspections" : `/inspections?kind=${tab.key}`}
              className={`rounded-full px-4 py-1.5 font-label-md text-label-md transition-colors ${
                isActive
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <InspectionList inspections={paged.rows} writable={writable} />

      <ListPagination
        page={paged.page}
        pages={paged.pages}
        total={paged.total}
        href="/inspections"
        params={{ kind }}
      />
    </div>
  );
}
