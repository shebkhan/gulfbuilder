import { FileSignature, Filter } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ListPagination } from "@/components/domain/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { paginate } from "@/lib/pagination";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

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
    .select(`
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
    `)
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
    query = query
      .eq("status", "active")
      .gte("end_date", today)
      .lte("end_date", in30Days);
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
        </div>

        {writable ? (
          <Link
            href="/leases/new"
            className="rounded-xl bg-primary px-4 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary/90"
          >
            {t("new")}
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <select
            name="status"
            defaultValue={status ?? "all"}
            className="h-10 rounded-xl bg-surface-container-lowest px-3 font-body-sm text-body-sm text-on-surface border border-hairline shadow-sm"
          >
            <option value="all">{t("allStatuses")}</option>
            <option value="active">{t("statuses.active")}</option>
            <option value="draft">{t("statuses.draft")}</option>
            <option value="terminated">{t("statuses.terminated")}</option>
            <option value="renewed">{t("statuses.renewed")}</option>
          </select>

          {buildings && buildings.length > 0 ? (
            <select
              name="buildingId"
              defaultValue={buildingId ?? "all"}
              className="h-10 rounded-xl bg-surface-container-lowest px-3 font-body-sm text-body-sm text-on-surface border border-hairline shadow-sm"
            >
              <option value="all">{t("allBuildings")}</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          ) : null}

          <button
            type="submit"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-hairline bg-surface-container-low px-3.5 font-label-sm text-label-sm text-on-surface hover:bg-surface-container"
          >
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </button>
        </form>

        <Link
          href={`/leases?expiring=${expiring === "true" ? "false" : "true"}`}
          className={`h-10 inline-flex items-center rounded-xl px-3 font-label-sm text-label-sm border transition-colors ${
            expiring === "true"
              ? "bg-primary-fixed/40 border-primary text-on-surface font-semibold"
              : "bg-surface-container-lowest border-hairline text-on-surface-variant hover:text-on-surface"
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
                          className="text-primary hover:underline underline-offset-4"
                        >
                          {lease.lease_no}
                        </Link>
                      </td>
                      <td className="p-4 text-on-surface">{tenantName}</td>
                      <td className="p-4 text-on-surface-variant">{unitLabel}</td>
                      <td className="p-4 text-on-surface-variant">
                        <DateCell date={lease.end_date} locale={locale} remaining />
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

