import { Building2, Eye, FileSignature, Mail, Phone, Plus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ListPagination } from "@/components/domain/list-pagination";
import { TenantSearch } from "@/components/domain/tenant-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { paginate } from "@/lib/pagination";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";
import { EmptyState } from "@/components/domain/empty-state";

type SearchParams = Promise<{
  q?: string;
  name?: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  buildingId?: string;
  page?: string;
}>;

export default async function TenantsPage({
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

  const { q, name, email, phone, idNumber, buildingId, page } = await searchParams;
  const t = await getTranslations("tenants");
  const writable = can(ctx.role, "tenants.write");

  // Fetch all buildings for filter dropdown
  const { data: rawBuildings } = await ctx.supabase
    .from("buildings")
    .select("id, code, name")
    .is("deleted_at", null)
    .order("code");

  const buildings = rawBuildings ?? [];

  // Query tenant directory
  let query = ctx.supabase
    .from("tenant_directory")
    .select("id, full_name, kind, phone, whatsapp, email, language")
    .is("deleted_at", null)
    .order("full_name");

  // Quick search: matches name, phone, or email
  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(
      `full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`,
    );
  }

  // Advanced search filters
  if (name && name.trim()) {
    query = query.ilike("full_name", `%${name.trim()}%`);
  }

  if (email && email.trim()) {
    query = query.ilike("email", `%${email.trim()}%`);
  }

  if (phone && phone.trim()) {
    const term = phone.trim();
    query = query.or(`phone.ilike.%${term}%,whatsapp.ilike.%${term}%`);
  }

  // Building filter: find tenants who have leases in this building
  let buildingTenantIds: Set<string> | null = null;
  if (buildingId && buildingId !== "all") {
    const { data: buildingUnits } = await ctx.supabase
      .from("units")
      .select("id")
      .eq("building_id", buildingId)
      .is("deleted_at", null);

    const unitIds = (buildingUnits ?? []).map((u) => u.id);
    if (unitIds.length > 0) {
      const { data: buildingLeases } = await ctx.supabase
        .from("leases")
        .select("tenant_id")
        .in("unit_id", unitIds);

      buildingTenantIds = new Set((buildingLeases ?? []).map((l) => l.tenant_id));
      query = query.in("id", Array.from(buildingTenantIds));
    } else {
      query = query.eq("id", "00000000-0000-0000-0000-000000000000"); // No units, empty match
    }
  }

  // Parallel fetch for filtered tenants, all leases with units/buildings for building tags, and lease counts
  const [{ data: rawTenants }, { data: allLeases }] = await Promise.all([
    query,
    ctx.supabase
      .from("leases")
      .select("tenant_id, status, units(id, unit_no, buildings(id, code, name))"),
  ]);

  // Aggregate lease counts & building names per tenant
  const leaseCountByTenant: Record<string, number> = {};
  const buildingsByTenant: Record<string, { id: string; code: string; name: string }[]> = {};

  for (const l of allLeases ?? []) {
    leaseCountByTenant[l.tenant_id] = (leaseCountByTenant[l.tenant_id] ?? 0) + 1;
    const unit = l.units as unknown as {
      id: string;
      unit_no: string;
      buildings: { id: string; code: string; name: string } | null;
    } | null;

    if (unit?.buildings) {
      const list = (buildingsByTenant[l.tenant_id] ??= []);
      if (!list.some((b) => b.id === unit.buildings!.id)) {
        list.push(unit.buildings);
      }
    }
  }

  // Filter by ID number if requested (checking decrypted ID numbers via RPC)
  let tenants = rawTenants ?? [];
  if (idNumber && idNumber.trim() && tenants.length > 0) {
    const targetId = idNumber.trim().toLowerCase();
    const checked = await Promise.all(
      tenants.map(async (tRow) => {
        try {
          const { data: decrypted } = await ctx.supabase.rpc("tenant_id_number", {
            p_tenant: tRow.id!,
          });
          return decrypted && decrypted.toLowerCase().includes(targetId) ? tRow : null;
        } catch {
          return null;
        }
      }),
    );
    tenants = checked.filter(Boolean) as typeof tenants;
  }

  const paged = paginate(tenants, Number(page ?? 1));

  const filterParams: Record<string, string | undefined> = {
    q,
    name,
    email,
    phone,
    idNumber,
    buildingId: buildingId !== "all" ? buildingId : undefined,
  };

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="tenants"
        role={ctx.role}
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {writable ? (
              <Button asChild>
                <Link href="/tenants/new">
                  <Plus aria-hidden />
                  {t("new")}
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        {/* Advanced Search & Filtering Component */}
        <TenantSearch
          buildings={buildings}
          currentParams={{ name, email, phone, idNumber, buildingId }}
          labels={{
            advancedSearch: t("advancedSearch"),
            searchByName: t("searchByName"),
            searchByEmail: t("searchByEmail"),
            searchByPhone: t("searchByPhone"),
            searchById: t("searchById"),
            filterByBuilding: t("filterByBuilding"),
            allBuildings: t("allBuildings"),
            clearFilters: t("clearFilters"),
            applyFilters: t("applyFilters"),
          }}
        />

        {/* Results Table (No individual, no language, clean table format) */}
        {tenants.length > 0 ? (
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface-container-lowest shadow-sm">
              <table className="w-full text-start text-sm">
                <thead>
                  <tr className="border-b border-hairline bg-surface-container-low/50 font-label-md text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    <th className="px-5 py-3.5 text-start">{t("tenant")}</th>
                    <th className="px-5 py-3.5 text-start">{t("contact")}</th>
                    <th className="px-5 py-3.5 text-start">{t("building")}</th>
                    <th className="px-5 py-3.5 text-start">{t("leases")}</th>
                    <th className="px-5 py-3.5 text-end">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {paged.rows.map((tenant) => {
                    const tenantBuildings = (tenant.id ? buildingsByTenant[tenant.id] : null) ?? [];
                    const leasesCount = (tenant.id ? leaseCountByTenant[tenant.id] : 0) ?? 0;

                    return (
                      <tr
                        key={tenant.id}
                        className="transition-colors hover:bg-surface-container-low/40"
                      >
                        {/* Name & Type (only Company badge if company, otherwise clean name) */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/tenants/${tenant.id}`}
                              className="font-headline-sm font-semibold text-on-surface hover:text-primary hover:underline"
                            >
                              {tenant.full_name}
                            </Link>
                            {tenant.kind === "company" && (
                              <Badge variant="info">{t("company")}</Badge>
                            )}
                          </div>
                        </td>

                        {/* Contact details */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1 text-xs text-on-surface-variant">
                            {tenant.phone ? (
                              <div className="flex items-center gap-1.5" dir="ltr">
                                <Phone className="size-3.5 shrink-0 text-on-surface-variant" />
                                <span>{tenant.phone}</span>
                              </div>
                            ) : null}
                            {tenant.email ? (
                              <div className="flex items-center gap-1.5">
                                <Mail className="size-3.5 shrink-0 text-on-surface-variant" />
                                <span>{tenant.email}</span>
                              </div>
                            ) : null}
                            {!tenant.phone && !tenant.email && <span>—</span>}
                          </div>
                        </td>

                        {/* Associated Buildings */}
                        <td className="px-5 py-4">
                          {tenantBuildings.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {tenantBuildings.map((b) => (
                                <Link
                                  key={b.id}
                                  href={`/buildings/${b.id}`}
                                  className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface-container-low px-2 py-0.5 text-xs text-on-surface hover:border-primary hover:text-primary"
                                >
                                  <Building2 className="size-3" />
                                  <span>{b.code}</span>
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-on-surface-variant">—</span>
                          )}
                        </td>

                        {/* Lease count badge */}
                        <td className="px-5 py-4">
                          <Badge variant={leasesCount > 0 ? "neutral" : "warning"}>
                            <FileSignature className="me-1 size-3" />
                            {leasesCount}
                          </Badge>
                        </td>

                        {/* Action link */}
                        <td className="px-5 py-4 text-end">
                          <Link
                            href={`/tenants/${tenant.id}`}
                            className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-container-low px-3 py-1 font-label-sm text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-high hover:text-primary"
                          >
                            <Eye className="size-3.5" />
                            <span>{t("view")}</span>
                          </Link>
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
              href="/tenants"
              params={filterParams}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-surface-container-low p-12 text-center">
            <EmptyState animation="/animations/empty-box.lottie" description={t("empty")} />
          </div>
        )}
      </div>
    </div>
  );
}
