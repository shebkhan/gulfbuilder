import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getOrgContext } from "@/server/org-context";
import { getTranslations } from "next-intl/server";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/domain/page-header";
import { BuildingSimulator } from "@/components/domain/building-simulator";
import { Link } from "@/i18n/navigation";

export default async function BuildingStackingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) return null;
  const t = await getTranslations("buildings");

  const { data: building } = await ctx.supabase
    .from("buildings")
    .select("id, code, name")
    .eq("id", id)
    .maybeSingle();
  if (!building) notFound();

  const [{ data: floors }, { data: units }, { data: org }] = await Promise.all([
    ctx.supabase.from("floors").select("id, level, label").eq("building_id", id).order("level"),
    ctx.supabase
      .from("units")
      .select("id, unit_no, floor_id, unit_type, area_sqm, default_rent_minor, currency, status, layout_order")
      .eq("building_id", id)
      .is("deleted_at", null)
      .order("unit_no"),
    ctx.supabase.from("organizations").select("base_currency").eq("id", ctx.orgId).maybeSingle(),
  ]);

  const unitIds = (units ?? []).map((u) => u.id);
  const { data: leases } =
    unitIds.length > 0
      ? await ctx.supabase
          .from("leases")
          .select("unit_id, tenants(full_name)")
          .in("unit_id", unitIds)
          .eq("status", "active")
      : { data: [] as { unit_id: string | null; tenants: { full_name: string } | null }[] };

  const tenantByUnit: Record<string, string> = {};
  for (const l of leases ?? []) {
    if (l.unit_id && l.tenants?.full_name) tenantByUnit[l.unit_id] = l.tenants.full_name;
  }

  const currency = org?.base_currency ?? "QAR";
  const writable = can(ctx.role, "properties.write");

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="buildings"
        role={ctx.role}
        actions={
          <Link
            href={`/buildings/${id}`}
            className="w-fit font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
          >
            ← {building.name}
          </Link>
        }
        title={building.name}
        description={t("stacking")}
      />
      <BuildingSimulator
        buildingId={building.id}
        buildingName={building.name}
        currency={currency}
        locale={locale}
        floors={(floors ?? []).map((f) => ({ id: f.id, level: f.level, label: f.label }))}
        units={(units ?? []).map((u) => ({
          id: u.id,
          unit_no: u.unit_no,
          floor_id: u.floor_id,
          unit_type: u.unit_type,
          area_sqm: u.area_sqm,
          default_rent_minor: u.default_rent_minor,
          currency: u.currency,
          status: u.status,
          layout_order: u.layout_order,
        }))}
        tenantByUnit={tenantByUnit}
        writable={writable}
      />
    </div>
  );
}