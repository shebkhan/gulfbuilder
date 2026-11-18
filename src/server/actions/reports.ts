import type { DashboardKpis } from "@/schemas/dashboard";
import { getOrgContext } from "@/server/org-context";
import {
  chequePipeline,
  collections,
  gprAndVacancyLoss,
  leaseExpiries,
  occupancy,
  type AllocationForKpi,
  type ChargeForKpi,
  type ChequeForKpi,
  type LeaseForKpi,
  type OccupancyKpi,
  type UnitForKpi,
  type ValueKpi,
} from "@/lib/kpi";

export type PortfolioKpis = DashboardKpis;

export async function fetchPortfolioKpis(): Promise<PortfolioKpis | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const { data, error } = await ctx.supabase.rpc("get_portfolio_kpis");
  if (error || !data) return null;

  return data as unknown as PortfolioKpis;
}

export type RentRollItem = {
  unit_no: string;
  building_name: string;
  building_code: string;
  tenant_name: string;
  lease_no: string;
  start_date: string;
  end_date: string;
  rent_minor: number;
  currency: string;
  status: string;
};

export async function fetchRentRoll(): Promise<RentRollItem[]> {
  const ctx = await getOrgContext();
  if (!ctx) return [];

  const { data, error } = await ctx.supabase
    .from("leases")
    .select(
      `
      lease_no,
      start_date,
      end_date,
      rent_minor,
      currency,
      status,
      tenants ( full_name ),
      units ( unit_no, buildings ( name, code ) )
    `,
    )
    .in("status", ["active", "draft"])
    .order("start_date", { ascending: false });

  if (error || !data) return [];

  return data.map((l) => {
    const tenant = l.tenants as unknown as { full_name: string } | null;
    const unit = l.units as unknown as {
      unit_no: string;
      buildings: { name: string; code: string } | null;
    } | null;

    return {
      unit_no: unit?.unit_no || "—",
      building_name: unit?.buildings?.name || "—",
      building_code: unit?.buildings?.code || "—",
      tenant_name: tenant?.full_name || "—",
      lease_no: l.lease_no,
      start_date: l.start_date,
      end_date: l.end_date,
      rent_minor: l.rent_minor,
      currency: l.currency,
      status: l.status,
    };
  });
}

export type AgedReceivableItem = {
  tenant_name: string;
  lease_no: string;
  days_overdue: number;
  bucket: "0_30" | "31_60" | "61_90" | "90_plus";
  amount_minor: number;
  currency: string;
  due_date: string;
};

export async function fetchAgedReceivables(): Promise<AgedReceivableItem[]> {
  const ctx = await getOrgContext();
  if (!ctx) return [];

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await ctx.supabase
    .from("charges")
    .select(
      `
      amount_minor,
      paid_minor,
      currency,
      due_date,
      leases (
        lease_no,
        tenants ( full_name )
      )
    `,
    )
    .eq("org_id", ctx.orgId)
    .in("status", ["pending", "partial", "overdue"])
    .lt("due_date", today)
    .order("due_date", { ascending: true });

  if (error || !data) return [];

  const now = new Date().getTime();

  return data.map((c) => {
    const dueTime = new Date(c.due_date).getTime();
    const daysOverdue = Math.max(0, Math.floor((now - dueTime) / (1000 * 60 * 60 * 24)));
    const openAmount = c.amount_minor - c.paid_minor;

    let bucket: AgedReceivableItem["bucket"] = "0_30";
    if (daysOverdue > 90) bucket = "90_plus";
    else if (daysOverdue > 60) bucket = "61_90";
    else if (daysOverdue > 30) bucket = "31_60";

    const leaseData = c.leases as unknown as {
      lease_no: string;
      tenants: { full_name: string } | null;
    } | null;

    return {
      tenant_name: leaseData?.tenants?.full_name || "—",
      lease_no: leaseData?.lease_no || "—",
      days_overdue: daysOverdue,
      bucket,
      amount_minor: openAmount,
      currency: c.currency,
      due_date: c.due_date,
    };
  });
}

// ── Portfolio reports (SPEC §9) ──────────────────────────────────────────────

export type ReportFilters = {
  from: string;
  to: string;
  buildingId: string;
};

/** Default to the current month so every report tab has data without setup. */
export function defaultReportFilters(params: {
  from?: string;
  to?: string;
  building?: string;
}): ReportFilters {
  const todayIso = new Date().toISOString().slice(0, 10);
  return {
    from: params.from || `${todayIso.slice(0, 7)}-01`,
    to: params.to || todayIso,
    buildingId: params.building || "",
  };
}

export type BuildingOption = { id: string; code: string; name: string };

/** The buildings the signed-in user may see, for the report filters. */
export async function fetchReportBuildings(): Promise<BuildingOption[]> {
  const ctx = await getOrgContext();
  if (!ctx) return [];
  const { data } = await ctx.supabase
    .from("buildings")
    .select("id, code, name")
    .is("deleted_at", null)
    .order("code");
  return data ?? [];
}

export type OccupancyReport = {
  occupancy: OccupancyKpi;
  value: ValueKpi;
  perBuilding: {
    id: string;
    code: string;
    name: string;
    total: number;
    occupied: number;
    vacant: number;
    occupancyPct: number;
    gpr: number;
    vacancyLoss: number;
  }[];
};

/** Physical occupancy and the rent lost to vacancy, per building. */
export async function fetchOccupancyReport(
  filters: ReportFilters,
): Promise<OccupancyReport | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  let buildingQuery = ctx.supabase
    .from("buildings")
    .select("id, code, name")
    .is("deleted_at", null)
    .order("code");
  if (filters.buildingId) buildingQuery = buildingQuery.eq("id", filters.buildingId);
  const { data: buildings } = await buildingQuery;
  if (!buildings || buildings.length === 0) {
    return { occupancy: occupancy([]), value: { gpr: 0, vacancyLoss: 0, egI: 0 }, perBuilding: [] };
  }

  const buildingIds = buildings.map((b) => b.id);
  const { data: units } = await ctx.supabase
    .from("units")
    .select("id, building_id, status, default_rent_minor")
    .in("building_id", buildingIds)
    .is("deleted_at", null);

  const unitRows = (units ?? []) as UnitForKpi[];
  const { data: leases } = unitRows.length
    ? await ctx.supabase
        .from("leases")
        .select("id, unit_id, status, start_date, end_date, rent_minor")
        .in("unit_id", unitRows.map((u) => u.id))
    : { data: [] };
  const leaseRows = (leases ?? []) as LeaseForKpi[];

  const perBuilding = buildings.map((building) => {
    const buildingUnits = unitRows.filter((unit) => unit.building_id === building.id);
    const unitIds = new Set(buildingUnits.map((unit) => unit.id));
    const buildingLeases = leaseRows.filter((lease) => lease.unit_id && unitIds.has(lease.unit_id));
    const stats = occupancy(buildingUnits);
    const value = gprAndVacancyLoss(buildingUnits, buildingLeases, filters.from, filters.to);
    return {
      id: building.id,
      code: building.code,
      name: building.name,
      total: stats.total,
      occupied: stats.occupied,
      vacant: stats.vacant,
      occupancyPct: stats.occupancyPct,
      gpr: value.gpr,
      vacancyLoss: value.vacancyLoss,
    };
  });

  return {
    occupancy: occupancy(unitRows),
    value: gprAndVacancyLoss(unitRows, leaseRows, filters.from, filters.to),
    perBuilding,
  };
}

export type ExpiryRow = {
  id: string;
  lease_no: string;
  tenant_name: string;
  building_name: string;
  unit_no: string;
  end_date: string;
  rent_minor: number;
  currency: string;
  daysLeft: number;
};

export type ExpiryReport = {
  buckets: { d30: number; d60: number; d90: number };
  renewalRate: number;
  renewed: number;
  expired: number;
  rows: ExpiryRow[];
};

/** Leases ending in the next 90 days, with the renewal rate for the period. */
export async function fetchExpiryReport(filters: ReportFilters): Promise<ExpiryReport | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  let query = ctx.supabase.from("leases").select(`
      id, lease_no, unit_id, tenant_id, status, start_date, end_date, rent_minor, currency,
      tenants ( full_name ),
      units ( unit_no, buildings ( id, name, code ) )
    `);
  if (filters.buildingId) {
    const { data: buildingUnits } = await ctx.supabase
      .from("units")
      .select("id")
      .eq("building_id", filters.buildingId);
    const unitIds = (buildingUnits ?? []).map((u) => u.id);
    if (unitIds.length === 0) {
      return {
        buckets: { d30: 0, d60: 0, d90: 0 },
        renewalRate: 0,
        renewed: 0,
        expired: 0,
        rows: [],
      };
    }
    query = query.in("unit_id", unitIds);
  }

  const { data: leases } = await query;
  if (!leases) {
    return {
      buckets: { d30: 0, d60: 0, d90: 0 },
      renewalRate: 0,
      renewed: 0,
      expired: 0,
      rows: [],
    };
  }

  const leaseRows = leases.map((lease) => ({
    id: lease.id,
    unit_id: lease.unit_id,
    status: lease.status,
    start_date: lease.start_date,
    end_date: lease.end_date,
    rent_minor: lease.rent_minor,
  })) as LeaseForKpi[];

  const buckets = leaseExpiries(leaseRows, filters.to);
  const expiringIds = new Set(
    [...buckets.d30, ...buckets.d60, ...buckets.d90].map((lease) => lease.id),
  );

  const rows: ExpiryRow[] = leases
    .filter((lease) => expiringIds.has(lease.id))
    .map((lease) => {
      const tenant = lease.tenants as unknown as { full_name: string } | null;
      const unit = lease.units as unknown as {
        unit_no: string;
        buildings: { id: string; name: string; code: string } | null;
      } | null;
      const daysLeft = Math.round(
        (new Date(`${lease.end_date}T00:00:00Z`).getTime() -
          new Date(`${filters.to}T00:00:00Z`).getTime()) /
          86_400_000,
      );
      return {
        id: lease.id,
        lease_no: lease.lease_no,
        tenant_name: tenant?.full_name ?? "—",
        building_name: unit?.buildings?.name ?? "—",
        unit_no: unit?.unit_no ?? "—",
        end_date: lease.end_date,
        rent_minor: lease.rent_minor,
        currency: lease.currency,
        daysLeft,
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return {
    buckets: { d30: buckets.d30.length, d60: buckets.d60.length, d90: buckets.d90.length },
    renewalRate: buckets.renewalRate,
    renewed: buckets.renewed,
    expired: buckets.expired,
    rows,
  };
}

export type CollectionRow = {
  building_name: string;
  building_code: string;
  billed: number;
  collected: number;
  outstanding: number;
  rate: number;
};

export type CollectionReport = {
  billed: number;
  collected: number;
  outstanding: number;
  rate: number;
  averageDaysToPay: number | null;
  perBuilding: CollectionRow[];
};

/** Billed against collected, with the average days a payment takes to land. */
export async function fetchCollectionReport(
  filters: ReportFilters,
): Promise<CollectionReport | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const [{ data: charges }, { data: payments }, { data: leases }] = await Promise.all([
    ctx.supabase
      .from("charges")
      .select("id, lease_id, type, due_date, amount_minor, paid_minor, status")
      .gte("due_date", filters.from)
      .lte("due_date", filters.to),
    ctx.supabase
      .from("payments")
      .select("id, received_at, amount_minor, lease_id")
      .gte("received_at", `${filters.from}T00:00:00Z`)
      .lte("received_at", `${filters.to}T23:59:59Z`),
    ctx.supabase
      .from("leases")
      .select("id, unit_id, units ( unit_no, building_id, buildings ( id, name, code ) )"),
  ]);

  const chargeRows = (charges ?? []) as ChargeForKpi[];
  const paymentRows = (payments ?? []) as {
    id: string;
    received_at: string;
    amount_minor: number;
  }[];

  const chargeIds = new Set(chargeRows.map((charge) => charge.id));
  const paymentIds = new Set(paymentRows.map((payment) => payment.id));
  const { data: allocations } = await ctx.supabase
    .from("payment_allocations")
    .select("payment_id, charge_id, amount_minor");
  const allocationRows = ((allocations ?? []) as AllocationForKpi[]).filter(
    (allocation) => chargeIds.has(allocation.charge_id) || paymentIds.has(allocation.payment_id),
  );

  const kpi = collections(chargeRows, paymentRows, allocationRows);

  // Split the charges over the buildings they belong to.
  const leaseById = new Map(
    (leases ?? []).map((lease) => {
      const unit = lease.units as unknown as {
        unit_no: string;
        building_id: string;
        buildings: { id: string; name: string; code: string } | null;
      } | null;
      return [lease.id, unit?.buildings ?? null];
    }),
  );

  const perBuilding = new Map<string, CollectionRow>();
  for (const charge of chargeRows) {
    if (charge.type !== "rent") continue;
    const building = leaseById.get(charge.lease_id) ?? null;
    const key = building?.id ?? "—";
    const row = perBuilding.get(key) ?? {
      building_name: building?.name ?? "—",
      building_code: building?.code ?? "—",
      billed: 0,
      collected: 0,
      outstanding: 0,
      rate: 0,
    };
    row.billed += charge.amount_minor;
    row.collected += charge.paid_minor;
    row.outstanding += charge.amount_minor - charge.paid_minor;
    row.rate = row.billed ? Math.round((row.collected / row.billed) * 1000) / 10 : 0;
    perBuilding.set(key, row);
  }

  return {
    billed: kpi.billed,
    collected: kpi.collected,
    outstanding: kpi.outstanding,
    rate: kpi.rate,
    averageDaysToPay: kpi.averageDaysToPay,
    perBuilding: [...perBuilding.values()].sort((a, b) => b.outstanding - a.outstanding),
  };
}

export type ChequeRow = {
  id: string;
  cheque_no: string;
  bank_name: string | null;
  amount_minor: number;
  currency: string;
  cheque_date: string;
  status: string;
  tenant_name: string;
};

export type ChequeReport = {
  byStatus: { status: string; count: number; amount: number }[];
  dueThisWeek: { count: number; amount: number };
  dueThisMonth: { count: number; amount: number };
  atRisk: { count: number; amount: number };
  rows: ChequeRow[];
};

/** Cheques by status, what is due soon, and what is at risk. */
export async function fetchChequeReport(filters: ReportFilters): Promise<ChequeReport | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const { data: cheques } = await ctx.supabase
    .from("cheques")
    .select(
      "id, cheque_no, bank_name, amount_minor, currency, cheque_date, status, tenants ( full_name )",
    )
    .gte("cheque_date", filters.from)
    .lte("cheque_date", filters.to);

  const rows: ChequeRow[] = (cheques ?? []).map((cheque) => {
    const tenant = cheque.tenants as unknown as { full_name: string } | null;
    return {
      id: cheque.id,
      cheque_no: cheque.cheque_no,
      bank_name: cheque.bank_name,
      amount_minor: cheque.amount_minor,
      currency: cheque.currency,
      cheque_date: cheque.cheque_date,
      status: cheque.status,
      tenant_name: tenant?.full_name ?? "—",
    };
  });

  const pipeline = chequePipeline(rows as ChequeForKpi[], filters.to);

  return {
    byStatus: Object.entries(pipeline.byStatus).map(([status, value]) => ({
      status,
      count: value.count,
      amount: value.amount,
    })),
    dueThisWeek: pipeline.dueThisWeek,
    dueThisMonth: pipeline.dueThisMonth,
    atRisk: pipeline.atRisk,
    rows: rows.sort((a, b) => a.cheque_date.localeCompare(b.cheque_date)),
  };
}
