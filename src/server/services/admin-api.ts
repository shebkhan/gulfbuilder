import type { ApiContext } from "@/lib/api/context";

type Ctx = ApiContext;

export async function getAdminUnitsSummary(ctx: Ctx) {
  const { data: units } = await ctx.supabase
    .from("units")
    .select("id, status, building_id")
    .eq("org_id", ctx.orgId);
  const byStatus: Record<string, number> = {};
  for (const u of units ?? []) byStatus[(u as { status: string }).status] = (byStatus[(u as { status: string }).status] ?? 0) + 1;
  return { total: (units ?? []).length, byStatus };
}

export async function getAdminChequesDue(ctx: Ctx, days = 30) {
  const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const { data } = await ctx.supabase
    .from("cheques")
    .select("id, cheque_no, bank_name, amount_minor, currency, cheque_date, status, lease_id, tenant_id")
    .eq("org_id", ctx.orgId)
    .in("status", ["received", "deposited"])
    .lte("cheque_date", cutoff)
    .order("cheque_date", { ascending: true });
  return data ?? [];
}

export async function getAdminLeases(ctx: Ctx, expiringDays?: number) {
  let q = ctx.supabase
    .from("leases")
    .select("id, lease_no, start_date, end_date, rent_minor, currency, deposit_minor, status, tenants(full_name), units(unit_no, buildings(code))")
    .eq("org_id", ctx.orgId)
    .order("end_date", { ascending: true });
  if (expiringDays) {
    const cutoff = new Date(Date.now() + expiringDays * 86400000).toISOString().slice(0, 10);
    q = q.gte("end_date", new Date().toISOString().slice(0, 10)).lte("end_date", cutoff);
  }
  const { data } = await q;
  return data ?? [];
}

export async function getAdminReceivables(ctx: Ctx) {
  const { data } = await ctx.supabase
    .from("charges")
    .select("id, due_date, amount_minor, paid_minor, currency, status, leases(lease_no, tenants(full_name), units(unit_no, buildings(code)))")
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

export async function getAdminMaintenance(ctx: Ctx) {
  const { data } = await ctx.supabase
    .from("maintenance_requests")
    .select("id, title, priority, status, opened_at, buildings(code), units(unit_no)")
    .eq("org_id", ctx.orgId)
    .in("status", ["open", "assigned", "in_progress"])
    .order("opened_at", { ascending: false });
  return data ?? [];
}

export async function getAdminApprovals(ctx: Ctx) {
  const { data } = await ctx.supabase
    .from("owner_expense_approvals")
    .select("id, expense_id, owner_id, status, requested_at, decided_at, note")
    .eq("org_id", ctx.orgId)
    .order("requested_at", { ascending: false });
  return data ?? [];
}

export async function getAdminDashboard(ctx: Ctx) {
  const [unitsRes, leasesRes, chequesRes, maintRes, chargesRes] = await Promise.all([
    ctx.supabase.from("units").select("id, status").eq("org_id", ctx.orgId),
    ctx.supabase.from("leases").select("id").eq("org_id", ctx.orgId).eq("status", "active"),
    ctx.supabase.from("cheques").select("id").eq("org_id", ctx.orgId).in("status", ["received", "deposited"]),
    ctx.supabase.from("maintenance_requests").select("id", { count: "exact", head: true }).eq("org_id", ctx.orgId).in("status", ["open", "assigned", "in_progress"]),
    ctx.supabase.from("charges").select("amount_minor, paid_minor").eq("org_id", ctx.orgId).eq("status", "overdue"),
  ]);
  const units = (unitsRes.data ?? []) as { status: string }[];
  const arrears = (chargesRes.data ?? []).reduce((acc: number, c: { amount_minor: number; paid_minor: number }) => acc + (c.amount_minor - c.paid_minor), 0);
  return {
    total_units: units.length,
    occupied_units: units.filter((u) => u.status === "occupied").length,
    vacant_units: units.filter((u) => u.status === "vacant").length,
    active_leases: (leasesRes.data ?? []).length,
    pending_cheques: (chequesRes.data ?? []).length,
    open_maintenance: maintRes.count ?? 0,
    overdue_receivables_minor: arrears,
  };
}

export async function getAdminDigest(ctx: Ctx) {
  const [dashboard, cheques, leases, receivables, maintenance] = await Promise.all([
    getAdminDashboard(ctx),
    getAdminChequesDue(ctx, 7),
    getAdminLeases(ctx, 30),
    getAdminReceivables(ctx),
    getAdminMaintenance(ctx),
  ]);
  const totalReceivable = receivables.reduce((acc, r) => acc + r.amount_minor, 0);
  return {
    generated_at: new Date().toISOString(),
    dashboard,
    cheques_due_7d: cheques,
    leases_expiring_30d: leases,
    receivables_total_minor: totalReceivable,
    open_maintenance: maintenance,
  };
}
