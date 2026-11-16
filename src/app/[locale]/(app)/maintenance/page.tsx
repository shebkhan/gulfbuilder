import { AlertTriangle, Clock, Wrench } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ListPagination } from "@/components/domain/list-pagination";
import { MaintenanceForm, type MaintenanceItem } from "@/components/domain/maintenance-form";
import { Card, CardBody, KpiLabel } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { paginate } from "@/lib/pagination";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

type SearchParams = Promise<{
  status?: string;
  priority?: string;
  page?: string;
}>;

export default async function MaintenancePage({
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

  const { page, status, priority } = await searchParams;
  const t = await getTranslations("maintenance");
  const writable = can(ctx.role, "maintenance.write");

  // Fetch requests
  let query = ctx.supabase
    .from("maintenance_requests")
    .select(`
      id,
      title,
      description,
      category,
      priority,
      status,
      cost_minor,
      currency,
      opened_at,
      resolved_at,
      buildings ( id, name, code ),
      units ( id, unit_no ),
      tenants ( id, full_name ),
      vendors ( id, name )
    `)
    .order("opened_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status as never);
  }

  if (priority && priority !== "all") {
    query = query.eq("priority", priority as never);
  }

  const { data: requests } = await query;

  // Options
  const { data: rawBuildings } = await ctx.supabase
    .from("buildings")
    .select("id, name, code")
    .is("deleted_at", null)
    .order("code");

  const { data: rawUnits } = await ctx.supabase
    .from("units")
    .select("id, unit_no, building_id")
    .order("unit_no");

  const { data: rawVendors } = await ctx.supabase
    .from("vendors")
    .select("id, name")
    .order("name");

  const buildingOptions = (rawBuildings || []).map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
  }));
  const unitOptions = (rawUnits || []).map((u) => ({
    id: u.id,
    unit_no: u.unit_no,
    building_id: u.building_id,
  }));
  const vendorOptions = (rawVendors || []).map((v) => ({ id: v.id, name: v.name }));

  const allRequests = requests || [];

  const openCount = allRequests.filter((r) => r.status === "open").length;
  const inProgressCount = allRequests.filter((r) => r.status === "in_progress").length;
  const urgentCount = allRequests.filter(
    (r) => (r.priority === "urgent" || r.priority === "high") && r.status !== "completed",
  ).length;

  const transformedRequests: MaintenanceItem[] = allRequests.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    priority: r.priority as MaintenanceItem["priority"],
    status: r.status as MaintenanceItem["status"],
    cost_minor: r.cost_minor,
    currency: r.currency,
    opened_at: r.opened_at,
    resolved_at: r.resolved_at,
    building: r.buildings as unknown as { id: string; name: string; code: string } | null,
    unit: r.units as unknown as { id: string; unit_no: string } | null,
    tenant: r.tenants as unknown as { id: string; full_name: string } | null,
    vendor: r.vendors as unknown as { id: string; name: string } | null,
  }));

  const paged = paginate(transformedRequests, Number(page ?? 1));

  const filterTabs = [
    { key: "all", label: "All" },
    { key: "open", label: t("statuses.open") },
    { key: "in_progress", label: t("statuses.in_progress") },
    { key: "waiting_parts", label: t("statuses.waiting_parts") },
    { key: "completed", label: t("statuses.completed") },
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
              <Clock className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>Open Work Orders</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {openCount}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-tertiary-fixed/40 text-tertiary">
              <Wrench className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>In Progress</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {inProgressCount}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-error-container text-error">
              <AlertTriangle className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>Urgent / High Priority</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {urgentCount}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline pb-2">
        {filterTabs.map((tab) => {
          const isActive = (!status && tab.key === "all") || status === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.key === "all" ? "/maintenance" : `/maintenance?status=${tab.key}`}
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

      <MaintenanceForm
        requests={paged.rows}
        buildings={buildingOptions}
        units={unitOptions}
        vendors={vendorOptions}
        writable={writable}
        locale={locale}
      />

      <ListPagination
        page={paged.page}
        pages={paged.pages}
        total={paged.total}
        href="/maintenance"
        params={{ status, priority }}
      />
    </div>
  );
}
