import type { ApiContext } from "@/lib/api/context";
import type {
  OwnerDashboard,
  OwnerReceivableRow,
} from "@/server/queries/owner-portal";

type Ctx = ApiContext;

async function resolveOwnerIds(ctx: Ctx): Promise<string[]> {
  if (ctx.ownerId) return [ctx.ownerId];
  const { data } = await ctx.supabase
    .from("owners")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("org_id", ctx.orgId);
  return (data ?? []).map((o) => o.id);
}

export type OwnerScopeResolved = {
  ownerIds: string[];
  buildingIds: string[];
  leaseIds: string[];
  tenantIds: string[];
  currency: string;
};

export async function resolveOwnerScope(ctx: Ctx): Promise<OwnerScopeResolved> {
  const ownerIds = await resolveOwnerIds(ctx);
  const { data: org } = await ctx.supabase
    .from("organizations")
    .select("base_currency")
    .eq("id", ctx.orgId)
    .maybeSingle();
  const currency = org?.base_currency ?? "QAR";

  if (ownerIds.length === 0) {
    return { ownerIds: [], buildingIds: [], leaseIds: [], tenantIds: [], currency };
  }

  const { data: buildings } = await ctx.supabase
    .from("buildings")
    .select("id")
    .in("owner_id", ownerIds)
    .eq("org_id", ctx.orgId);
  const buildingIds = (buildings ?? []).map((b) => b.id);

  if (buildingIds.length === 0) {
    return { ownerIds, buildingIds: [], leaseIds: [], tenantIds: [], currency };
  }

  const { data: units } = await ctx.supabase
    .from("units")
    .select("id")
    .in("building_id", buildingIds)
    .eq("org_id", ctx.orgId);
  const unitIds = (units ?? []).map((u) => u.id);

  const { data: rooms } = unitIds.length
    ? await ctx.supabase.from("rooms").select("id").in("unit_id", unitIds).eq("org_id", ctx.orgId)
    : { data: [] as never[] };
  const roomIds = (rooms ?? []).map((r) => (r as { id: string }).id);

  const orParts: string[] = [];
  if (unitIds.length) orParts.push(`unit_id.in.(${unitIds.join(",")})`);
  if (roomIds.length) orParts.push(`room_id.in.(${roomIds.join(",")})`);

  const { data: leases } = orParts.length
    ? await ctx.supabase
        .from("leases")
        .select("id, tenant_id")
        .or(orParts.join(","))
        .eq("org_id", ctx.orgId)
    : { data: [] as never[] };
  const allLeases = leases ?? [];
  const leaseIds = allLeases.map((l) => (l as { id: string }).id);
  const tenantIds = [...new Set(allLeases.map((l) => (l as { tenant_id: string }).tenant_id).filter(Boolean))] as string[];

  return { ownerIds, buildingIds, leaseIds, tenantIds, currency };
}

export async function getOwnerDashboardData(ctx: Ctx): Promise<OwnerDashboard> {
  const scope = await resolveOwnerScope(ctx);
  if (scope.buildingIds.length === 0) {
    return {
      totalUnits: 0,
      occupiedUnits: 0,
      expectedThisMonth: 0n,
      collectedThisMonth: 0n,
      arrears: 0n,
      noiYearToDate: 0n,
      upcomingCheques: [],
      openMaintenance: 0,
      expiringLeases: [],
      nextPayout: null,
      closingBalance: 0n,
    };
  }
  const now = new Date();
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const yearStart = `${now.getUTCFullYear()}-01-01`;

  const [unitsRes, chargesRes, paymentsRes, expensesRes, chequesRes, maintRes, statementsRes, payoutsRes] =
    await Promise.all([
      ctx.supabase.from("units").select("id, status").in("building_id", scope.buildingIds).eq("org_id", ctx.orgId),
      scope.leaseIds.length
        ? ctx.supabase.from("charges").select("id, due_date, amount_minor, paid_minor, currency, status").in("lease_id", scope.leaseIds).eq("org_id", ctx.orgId).gte("due_date", yearStart)
        : Promise.resolve({ data: [] as never[] }),
      scope.leaseIds.length
        ? ctx.supabase.from("payments").select("id, received_at, amount_minor, currency, status").in("lease_id", scope.leaseIds).eq("org_id", ctx.orgId).gte("received_at", yearStart)
        : Promise.resolve({ data: [] as never[] }),
      ctx.supabase.from("expenses").select("id, amount_minor, currency, status, expense_date").in("building_id", scope.buildingIds).eq("org_id", ctx.orgId).eq("status", "paid"),
      scope.leaseIds.length
        ? ctx.supabase.from("cheques").select("id, cheque_no, bank_name, amount_minor, currency, cheque_date, status").in("lease_id", scope.leaseIds).eq("org_id", ctx.orgId).in("status", ["received", "deposited"]).order("cheque_date", { ascending: true }).limit(6)
        : Promise.resolve({ data: [] as never[] }),
      ctx.supabase.from("maintenance_requests").select("id", { count: "exact", head: true }).in("building_id", scope.buildingIds).eq("org_id", ctx.orgId).in("status", ["open", "assigned", "in_progress"]),
      scope.ownerIds.length
        ? ctx.supabase.from("owner_statements").select("id, status, period_start, period_end, closing_minor, currency").in("owner_id", scope.ownerIds).eq("org_id", ctx.orgId).order("period_start", { ascending: false })
        : Promise.resolve({ data: [] as never[] }),
      scope.ownerIds.length
        ? ctx.supabase.from("owner_payouts").select("id, amount_minor, currency, paid_on").in("owner_id", scope.ownerIds).eq("org_id", ctx.orgId).order("paid_on", { ascending: false })
        : Promise.resolve({ data: [] as never[] }),
    ]);

  const units = (unitsRes.data ?? []) as { id: string; status: string }[];
  const charges = (chargesRes.data ?? []) as { due_date: string; amount_minor: number; paid_minor: number; status: string }[];
  const payments = (paymentsRes.data ?? []) as { received_at: string; amount_minor: number }[];
  const expenses = (expensesRes.data ?? []) as { amount_minor: number }[];
  const cheques = (chequesRes.data ?? []) as OwnerDashboard["upcomingCheques"];
  const maintCount = maintRes.count ?? 0;
  const statements = (statementsRes.data ?? []) as { closing_minor: number }[];
  const payouts = (payoutsRes.data ?? []) as { amount_minor: number; currency: string; paid_on: string }[];

  const expectedThisMonth = charges
    .filter((c) => c.due_date >= monthStart)
    .reduce((acc, c) => acc + BigInt(c.amount_minor), 0n);
  const collectedThisMonth = payments
    .filter((p) => p.received_at.slice(0, 10) >= monthStart)
    .reduce((acc, p) => acc + BigInt(p.amount_minor), 0n);
  const arrears = charges
    .filter((c) => c.status === "overdue")
    .reduce((acc, c) => acc + BigInt(c.amount_minor - c.paid_minor), 0n);
  const collectedYtd = payments.reduce((acc, p) => acc + BigInt(p.amount_minor), 0n);
  const expensesYtd = expenses.reduce((acc, e) => acc + BigInt(e.amount_minor), 0n);

  const { data: expiring } = scope.leaseIds.length
    ? await ctx.supabase
        .from("leases")
        .select("id, lease_no, end_date, tenants(full_name)")
        .in("id", scope.leaseIds)
        .eq("org_id", ctx.orgId)
        .gte("end_date", now.toISOString().slice(0, 10))
        .lte("end_date", new Date(now.getTime() + 90 * 86400000).toISOString().slice(0, 10))
        .order("end_date", { ascending: true })
    : { data: [] as never[] };

  const lastStatement = statements[0];

  return {
    totalUnits: units.length,
    occupiedUnits: units.filter((u) => u.status === "occupied").length,
    expectedThisMonth,
    collectedThisMonth,
    arrears,
    noiYearToDate: collectedYtd - expensesYtd,
    upcomingCheques: cheques,
    openMaintenance: maintCount,
    expiringLeases: (expiring ?? []).map((l) => {
      const tenant = (l as { tenants: { full_name: string } | null }).tenants;
      return {
        id: (l as { id: string }).id,
        lease_no: (l as { lease_no: string }).lease_no,
        end_date: (l as { end_date: string }).end_date,
        tenant_name: tenant?.full_name ?? "",
      };
    }),
    nextPayout: payouts[0] ? { amount_minor: payouts[0].amount_minor, currency: payouts[0].currency, paid_on: payouts[0].paid_on } : null,
    closingBalance: BigInt(lastStatement?.closing_minor ?? 0),
  };
}

export async function getOwnerUnitsSummary(ctx: Ctx) {
  const scope = await resolveOwnerScope(ctx);
  const { data: units } = await ctx.supabase
    .from("units")
    .select("id, status, building_id, buildings(code)")
    .in("building_id", scope.buildingIds.length ? scope.buildingIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("org_id", ctx.orgId);
  const byStatus: Record<string, number> = {};
  for (const u of units ?? []) byStatus[(u as { status: string }).status] = (byStatus[(u as { status: string }).status] ?? 0) + 1;
  return { total: (units ?? []).length, byStatus, buildings: scope.buildingIds.length };
}

export async function getOwnerChequesDue(ctx: Ctx, days = 30) {
  const scope = await resolveOwnerScope(ctx);
  if (scope.leaseIds.length === 0) return [];
  const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const { data } = await ctx.supabase
    .from("cheques")
    .select("id, cheque_no, bank_name, amount_minor, currency, cheque_date, status, lease_id")
    .in("lease_id", scope.leaseIds)
    .eq("org_id", ctx.orgId)
    .in("status", ["received", "deposited"])
    .lte("cheque_date", cutoff)
    .order("cheque_date", { ascending: true });
  return data ?? [];
}

export async function getOwnerLeases(ctx: Ctx, expiringDays?: number) {
  const scope = await resolveOwnerScope(ctx);
  if (scope.leaseIds.length === 0) return [];
  let q = ctx.supabase
    .from("leases")
    .select("id, lease_no, start_date, end_date, rent_minor, currency, deposit_minor, status, tenants(full_name), units(unit_no, buildings(code))")
    .in("id", scope.leaseIds)
    .eq("org_id", ctx.orgId)
    .order("end_date", { ascending: true });
  if (expiringDays) {
    const cutoff = new Date(Date.now() + expiringDays * 86400000).toISOString().slice(0, 10);
    q = q.gte("end_date", new Date().toISOString().slice(0, 10)).lte("end_date", cutoff);
  }
  const { data } = await q;
  return data ?? [];
}

export async function getOwnerReceivables(ctx: Ctx): Promise<OwnerReceivableRow[]> {
  const scope = await resolveOwnerScope(ctx);
  if (scope.leaseIds.length === 0) return [];
  const { data } = await ctx.supabase
    .from("charges")
    .select("id, due_date, amount_minor, paid_minor, currency, status, leases(lease_no, tenants(full_name), units(unit_no, buildings(code)))")
    .in("lease_id", scope.leaseIds)
    .eq("org_id", ctx.orgId)
    .in("status", ["pending", "partial", "overdue"])
    .order("due_date", { ascending: true });
  const today = Date.now();
  return (data ?? []).map((c) => {
    const lease = c.leases as unknown as { tenants: { full_name: string } | null; units: { buildings: { code: string } | null } | null } | null;
    const days = Math.max(0, Math.floor((today - new Date(c.due_date).getTime()) / 86400000));
    return {
      tenant_name: lease?.tenants?.full_name ?? "",
      building_code: lease?.units?.buildings?.code ?? null,
      due_date: c.due_date,
      days_overdue: days,
      amount_minor: c.amount_minor - c.paid_minor,
      currency: c.currency,
    };
  });
}

export async function getOwnerStatements(ctx: Ctx) {
  const scope = await resolveOwnerScope(ctx);
  if (scope.ownerIds.length === 0) return [];
  const { data } = await ctx.supabase
    .from("owner_statements")
    .select("id, period_start, period_end, currency, status, opening_minor, closing_minor, totals, issued_at")
    .in("owner_id", scope.ownerIds)
    .eq("org_id", ctx.orgId)
    .order("period_start", { ascending: false });
  return data ?? [];
}

export async function getOwnerPayouts(ctx: Ctx) {
  const scope = await resolveOwnerScope(ctx);
  if (scope.ownerIds.length === 0) return [];
  const { data } = await ctx.supabase
    .from("owner_payouts")
    .select("id, amount_minor, currency, paid_on, method, reference")
    .in("owner_id", scope.ownerIds)
    .eq("org_id", ctx.orgId)
    .order("paid_on", { ascending: false });
  return data ?? [];
}

export async function getOwnerApprovals(ctx: Ctx) {
  const scope = await resolveOwnerScope(ctx);
  if (scope.ownerIds.length === 0) return [];
  const { data } = await ctx.supabase
    .from("owner_expense_approvals")
    .select("id, expense_id, owner_id, status, requested_at, decided_at, note, expenses(id, category, description, amount_minor, currency, status, expense_date, buildings(code))")
    .in("owner_id", scope.ownerIds)
    .eq("org_id", ctx.orgId)
    .order("requested_at", { ascending: false });
  return data ?? [];
}

export async function getOwnerMaintenance(ctx: Ctx) {
  const scope = await resolveOwnerScope(ctx);
  if (scope.buildingIds.length === 0) return [];
  const { data } = await ctx.supabase
    .from("maintenance_requests")
    .select("id, title, priority, status, opened_at, buildings(code), units(unit_no)")
    .in("building_id", scope.buildingIds)
    .eq("org_id", ctx.orgId)
    .in("status", ["open", "assigned", "in_progress"])
    .order("opened_at", { ascending: false });
  return data ?? [];
}

export async function getOwnerDocuments(ctx: Ctx) {
  const scope = await resolveOwnerScope(ctx);
  const ids = [...scope.buildingIds, ...scope.leaseIds];
  if (ids.length === 0) return [];
  const { data } = await ctx.supabase
    .from("documents")
    .select("id, entity_type, entity_id, kind, path, expires_on, created_at")
    .in("entity_id", ids)
    .eq("org_id", ctx.orgId);
  return data ?? [];
}

export async function getOwnerDigest(ctx: Ctx) {
  const [dashboard, cheques, leases, receivables, maintenance, approvals] = await Promise.all([
    getOwnerDashboardData(ctx),
    getOwnerChequesDue(ctx, 7),
    getOwnerLeases(ctx, 30),
    getOwnerReceivables(ctx),
    getOwnerMaintenance(ctx),
    getOwnerApprovals(ctx),
  ]);
  const pendingApprovals = (approvals as { status: string }[]).filter((a) => a.status === "pending");
  const totalReceivable = receivables.reduce((acc, r) => acc + r.amount_minor, 0);
  return {
    generated_at: new Date().toISOString(),
    dashboard,
    cheques_due_7d: cheques,
    leases_expiring_30d: leases,
    receivables_total_minor: totalReceivable,
    open_maintenance: maintenance,
    pending_approvals: pendingApprovals,
  };
}
