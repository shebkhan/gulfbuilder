import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LeaseForm } from "@/components/domain/lease-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/rbac";
import type { PickerTenant } from "@/lib/tenant-picker";
import { getOrgContext } from "@/server/org-context";

type SearchParams = Promise<{
  tenantId?: string;
  unitId?: string;
}>;

export default async function NewLeasePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "leases.write")) return null;

  const { tenantId, unitId } = await searchParams;
  const t = await getTranslations("leases");
  const isRtl = locale === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  // 1. Fetch available units (vacant or reserved)
  const { data: rawUnits } = await ctx.supabase
    .from("units")
    .select(`
      id,
      unit_no,
      status,
      default_rent_minor,
      buildings!inner ( id, name, code )
    `)
    .in("status", ["vacant", "reserved"])
    .is("deleted_at", null)
    .order("unit_no");

  const units = (rawUnits ?? []).map((u) => ({
    id: u.id,
    unit_no: u.unit_no,
    building_name: (u.buildings as unknown as { name: string })?.name || "",
    default_rent_minor: u.default_rent_minor,
  }));

  // 2. Fetch available rooms if any
  const { data: rawRooms } = await ctx.supabase
    .from("rooms")
    .select(`
      id,
      room_number,
      status,
      units!inner (
        id,
        unit_no,
        buildings!inner ( name )
      )
    `)
    .in("status", ["vacant", "reserved"])
    .order("room_number");

  const rooms = (rawRooms ?? []).map((r) => {
    const u = r.units as unknown as {
      unit_no: string;
      buildings: { name: string } | null;
    };
    return {
      id: r.id,
      room_number: r.room_number,
      unit_no: u?.unit_no || "",
      building_name: u?.buildings?.name || "",
    };
  });

  // 3. Fetch buildings for the tenant picker (tenants load on demand per building)
  const { data: rawBuildings } = await ctx.supabase
    .from("buildings")
    .select("id, code, name")
    .order("code");
  const buildings = rawBuildings ?? [];

  // Resolve a ?tenantId= deep link to the tenant's building so the picker starts selected.
  const { data: linkedTenant } = tenantId
    ? await ctx.supabase
        .from("tenant_directory")
        .select("id, full_name, nationality")
        .eq("id", tenantId)
        .is("deleted_at", null)
        .maybeSingle()
    : { data: null };

  let initialTenant: (PickerTenant & { buildingId: string }) | undefined;
  if (linkedTenant && tenantId) {
    const { data: activeLeases } = await ctx.supabase
      .from("leases")
      .select("unit_id, room_id")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .limit(1);

    let linkedLease = activeLeases?.[0];
    if (!linkedLease) {
      // A tenant with no active lease (the usual deep-link case) still needs a building.
      const { data: anyLeases } = await ctx.supabase
        .from("leases")
        .select("unit_id, room_id")
        .eq("tenant_id", tenantId)
        .limit(1);
      linkedLease = anyLeases?.[0];
    }

    let unitId = linkedLease?.unit_id ?? null;
    if (!unitId && linkedLease?.room_id) {
      const { data: room } = await ctx.supabase
        .from("rooms")
        .select("unit_id")
        .eq("id", linkedLease.room_id)
        .maybeSingle();
      unitId = room?.unit_id ?? null;
    }
    const { data: unit } = unitId
      ? await ctx.supabase.from("units").select("building_id").eq("id", unitId).maybeSingle()
      : { data: null };

    if (unit?.building_id) {
      const { data: plainId } = await ctx.supabase.rpc("tenant_id_number", {
        p_tenant: linkedTenant.id,
      });
      initialTenant = {
        id: linkedTenant.id,
        full_name: linkedTenant.full_name,
        id_number: plainId ?? null,
        nationality: linkedTenant.nationality,
        buildingId: unit.building_id,
      };
    }
  }

  // 4. Fetch active parent leases for sub-let mode
  const { data: rawParentLeases } = await ctx.supabase
    .from("leases")
    .select(`
      id,
      lease_no,
      unit_id,
      tenants!inner ( full_name )
    `)
    .eq("status", "active")
    .is("parent_lease_id", null);

  const activeParentLeases = (rawParentLeases ?? []).map((l) => ({
    id: l.id,
    lease_no: l.lease_no,
    unit_id: l.unit_id,
    tenant_name: (l.tenants as unknown as { full_name: string })?.full_name || "",
  }));

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex items-center gap-3">
        <Link
          href="/leases"
          className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
        >
          <BackIcon className="h-4 w-4" />
          <span>{t("allLeases")}</span>
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("new")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("facts")}</CardTitle>
        </CardHeader>
        <CardBody>
          <LeaseForm
            units={units}
            rooms={rooms}
            buildings={buildings}
            activeParentLeases={activeParentLeases}
            initialTenant={initialTenant}
            defaultUnitId={unitId}
            currency={ctx.currency}
            labels={{
              leaseNo: t("leaseNo"),
              autoLeaseNo: t("autoLeaseNo"),
              leaseNoHint: t("leaseNoHint"),
              tenant: t("tenant"),
              selectTenant: t("selectTenant"),
              unit: t("unit"),
              selectUnit: t("selectUnit"),
              room: t("room"),
              startDate: t("startDate"),
              endDate: t("endDate"),
              rent: t("rent"),
              rentHint: t("rentHint"),
              currency: t("currency"),
              frequency: t("frequency"),
              frequencies: t.raw("frequencies") as Record<string, string>,
              installments: t("installments"),
              dueDay: t("dueDay"),
              dueDayHint: t("dueDayHint"),
              deposit: t("deposit"),
              depositHint: t("depositHint"),
              noticeDays: t("noticeDays"),
              noticeDaysHint: t("noticeDaysHint"),
              isSublet: t("isSublet"),
              parentLease: t("parentLease"),
              selectParentLease: t("selectParentLease"),
              mainTenant: t("mainTenant"),
              subletExplanation: t("subletExplanation"),
              preview: t("preview"),
              type: t("type"),
              period: t("period"),
              dueDate: t("dueDate"),
              amount: t("amount"),
              create: t("create"),
              creating: t("creating"),
              created: t("created"),
              errors: t.raw("errors") as Record<string, string>,
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}

