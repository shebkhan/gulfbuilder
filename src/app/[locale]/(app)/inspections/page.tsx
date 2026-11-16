import { ClipboardCheck, Clock } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { InspectionForm, type InspectionItem } from "@/components/domain/inspection-form";
import { Card, CardBody, KpiLabel } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

type SearchParams = Promise<{
  kind?: string;
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

  const { kind } = await searchParams;
  const t = await getTranslations("inspections");
  const writable = can(ctx.role, "maintenance.write");

  // Fetch inspections
  let query = ctx.supabase
    .from("inspections")
    .select(`
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
    `)
    .order("created_at", { ascending: false });

  if (kind && kind !== "all") {
    query = query.eq("kind", kind);
  }

  const { data: inspections } = await query;

  // Fetch leases for inspection picker
  const { data: rawLeases } = await ctx.supabase
    .from("leases")
    .select("id, lease_no, tenants ( full_name )")
    .in("status", ["active", "draft", "terminated"])
    .order("lease_no");

  const leaseOptions = (rawLeases || []).map((l) => {
    const tenant = l.tenants as unknown as { full_name: string } | null;
    return {
      id: l.id,
      lease_no: l.lease_no,
      tenant_name: tenant?.full_name || "Unknown",
    };
  });

  const allInspections = inspections || [];

  const moveInCount = allInspections.filter((i) => i.kind === "move_in").length;
  const moveOutCount = allInspections.filter((i) => i.kind === "move_out").length;
  const pendingCount = allInspections.filter((i) => !i.completed_at).length;

  const transformedInspections: InspectionItem[] = allInspections.map((i) => {
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
    { key: "all", label: "All" },
    { key: "move_in", label: t("moveIn") },
    { key: "move_out", label: t("moveOut") },
  ];

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-fixed/40 text-primary">
              <ClipboardCheck className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>Move-In Surveys</KpiLabel>
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
              <KpiLabel>Move-Out Surveys</KpiLabel>
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
              <KpiLabel>Pending Completion</KpiLabel>
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

      <InspectionForm
        inspections={transformedInspections}
        leases={leaseOptions}
        writable={writable}
      />
    </div>
  );
}
