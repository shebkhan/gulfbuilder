import { FileSignature, Filter } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ListPagination } from "@/components/domain/list-pagination";
import { Badge } from "@/components/ui/badge";
import { DateCell, DaysLeft } from "@/components/domain/date-cell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { paginate } from "@/lib/pagination";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";

type SearchParams = Promise<{
  status?: string;
  buildingId?: string;
  expiring?: string;
  page?: string;
}>;

export default async function LeasesPage({
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

  const { page, status, buildingId, expiring } = await searchParams;
  const t = await getTranslations("leases");
  const tc = await getTranslations("common");
  const writable = can(ctx.role, "leases.write");

  // Fetch buildings for filter
  const { data: buildings } = await ctx.supabase
    .from("buildings")
    .select("id, code, name")
    .is("deleted_at", null)
    .order("code");

  // Fetch leases
  let query = ctx.supabase
    .from("leases")
    .select(
      `
      id,
      lease_no,
      start_date,
      end_date,
      rent_minor,
      currency,
      status,
      unit_id,
      room_id,
      tenants!inner ( id, full_name ),
      units ( id, unit_no, building_id, buildings ( id, code, name ) )
    `,
    )
    .order("start_date", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status as never);
  }

  if (buildingId && buildingId !== "all") {
    query = query.eq("units.building_id", buildingId);
  }

  if (expiring === "true") {
    const today = new Date().toISOString().slice(0, 10);
    const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    query = query.eq("status", "active").gte("end_date", today).lte("end_date", in30Days);
  }

  const { data: leases } = await query;

  const paged = paginate(leases ?? [], Number(page ?? 1));

  const getStatusVariant = (s: string) => {
    switch (s) {
      case "active":
        return "success";
      case "draft":
        return "info";
      case "terminated":
        return "danger";
      default:
        return "neutral";
    }
  };

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="leases"
        role={ctx.role}
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-3">

        {writable ? (
          <Link
            href="/leases/new"
            className="rounded-xl bg-primary px-4 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary/90"
          >
            {t("new")}
          </Link>
        ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <Select name="status" defaultValue={status ?? "all"}>
            <SelectTrigger className="h-10 w-40 font-body-sm text-body-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatuses")}</SelectItem>
              <SelectItem value="active">{t("statuses.active")}</SelectItem>
              <SelectItem value="draft">{t("statuses.draft")}</SelectItem>
              <SelectItem value="terminated">{t("statuses.terminated")}</SelectItem>
              <SelectItem value="renewed">{t("statuses.renewed")}</SelectItem>
            </SelectContent>
          </Select>

          {buildings && buildings.length > 0 ? (
            <Select name="buildingId" defaultValue={buildingId ?? "all"}>
              <SelectTrigger className="h-10 w-56 font-body-sm text-body-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allBuildings")}</SelectItem>
                {buildings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <button
            type="submit"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-hairline bg-surface-container-low px-3.5 font-label-sm text-label-sm text-on-surface hover:bg-surface-container"
          >
            <Filter className="h-4 w-4" />
            <span>{t("filter")}</span>
          </button>
        </form>

        <Link
          href={`/leases?expiring=${expiring === "true" ? "false" : "true"}`}
          className={`inline-flex h-10 items-center rounded-xl border px-3 font-label-sm text-label-sm transition-colors ${
            expiring === "true"
              ? "border-primary bg-primary-fixed/40 font-semibold text-on-surface"
              : "border-hairline bg-surface-container-lowest text-on-surface-variant hover:text-on-surface"
          }`}
        >
          {t("expiringSoon")}
        </Link>
      </div>

      {leases && leases.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-container-lowest shadow-card">
            <table className="w-full text-start font-body-sm text-body-sm">
              <thead>
                <tr className="border-b border-hairline text-on-surface-variant">
                  <th className="p-4 text-start font-medium">{t("leaseNo")}</th>
                  <th className="p-4 text-start font-medium">{t("tenant")}</th>
                  <th className="p-4 text-start font-medium">{t("unit")}</th>
                  <th className="p-4 text-start font-medium">{t("endDate")}</th>
                  <th className="p-4 text-start font-medium">{tc("daysLeftHeader")}</th>
                  <th className="p-4 text-end font-medium">{t("rent")}</th>
                  <th className="p-4 text-center font-medium">{t("filterStatus")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {paged.rows.map((lease) => {
                  const tenantName =
                    (lease.tenants as unknown as { full_name: string })?.full_name ?? "—";
                  const unitData = lease.units as unknown as {
                    unit_no: string;
                    buildings: { name: string; code: string } | null;
                  } | null;
                  const unitLabel = unitData
                    ? `${unitData.buildings?.code || ""} · ${unitData.unit_no}`
                    : "—";

                  return (
                    <tr key={lease.id} className="hover:bg-surface-container-low/40">
                      <td className="p-4 font-medium text-on-surface">
                        <Link
                          href={`/leases/${lease.id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {lease.lease_no}
                        </Link>
                      </td>
                      <td className="p-4 text-on-surface">
                        <Link
                          href={`/tenants/${(lease.tenants as unknown as { id: string }).id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {tenantName}
                        </Link>
                      </td>
                      <td className="p-4 text-on-surface-variant">{unitLabel}</td>
                      <td className="p-4 text-on-surface-variant">
                        <DateCell date={lease.end_date} locale={locale} />
                      </td>
                      <td className="p-4 text-on-surface-variant">
                        <DaysLeft date={lease.end_date} />
                      </td>
                      <td className="p-4 text-end font-medium text-on-surface">
                        {formatMoney(BigInt(lease.rent_minor), lease.currency)}
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant={getStatusVariant(lease.status)}>
                          {t(`statuses.${lease.status}`)}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ListPagination
            page={paged.page}
            pages={paged.pages}
            total={paged.total}
            href="/leases"
            params={{ status, buildingId, expiring }}
          />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-surface-container-low p-12 text-center">
          <FileSignature className="mb-3 h-10 w-10 text-on-surface-variant/60" />
          <p className="font-body-md text-body-md text-on-surface-variant">{t("empty")}</p>
        </div>
      )}
    </div>
  );
}
