import type { ApiContext } from "@/lib/api/context";

type Ctx = ApiContext;

export async function getTenantPortalData(ctx: Ctx) {
  const { data: tenantRows } = await ctx.supabase
    .from("tenants")
    .select("id, full_name, phone, email, language")
    .eq("user_id", ctx.userId)
    .eq("org_id", ctx.orgId)
    .limit(1);
  const tenant = tenantRows?.[0];
  if (!tenant) {
    return { tenant: null, leases: [], charges: [], payments: [], credits: [], requests: [], documents: [] };
  }

  const [leaseRows, paymentRows, creditRows, requestRows] = await Promise.all([
    ctx.supabase.from("leases").select("id, lease_no, start_date, end_date, rent_minor, currency, status, payment_frequency, due_day, deposit_minor, unit_id, room_id, units(unit_no, buildings(code, name)), rooms(room_no)").eq("tenant_id", tenant.id).eq("org_id", ctx.orgId).order("start_date", { ascending: false }),
    ctx.supabase.from("payments").select("id, receipt_no, receipt_year, amount_minor, currency, method, received_at, reference, status, proof_path").eq("tenant_id", tenant.id).eq("org_id", ctx.orgId).order("received_at", { ascending: false }),
    ctx.supabase.from("tenant_credits").select("id, amount_minor, remaining_minor, currency, note").eq("tenant_id", tenant.id).eq("org_id", ctx.orgId),
    ctx.supabase.from("maintenance_requests").select("id, title, description, category, priority, status, opened_at, resolved_at").eq("tenant_id", tenant.id).eq("org_id", ctx.orgId).order("opened_at", { ascending: false }),
  ]);

  const leases = (leaseRows.data ?? []).map((l: Record<string, unknown>) => {
    const unit = l.units as { unit_no: string; buildings: { code: string; name: string } | null } | null;
    const room = l.rooms as { room_no: string } | null;
    return {
      id: l.id, lease_no: l.lease_no, start_date: l.start_date, end_date: l.end_date,
      rent_minor: l.rent_minor, currency: l.currency, status: l.status,
      payment_frequency: l.payment_frequency, due_day: l.due_day, deposit_minor: l.deposit_minor,
      unit_no: unit?.unit_no ?? null, room_no: room?.room_no ?? null,
      building_code: unit?.buildings?.code ?? null, building_name: unit?.buildings?.name ?? null,
    };
  });

  const leaseIds = leases.map((l) => l.id);
  const { data: chargeRows } = leaseIds.length
    ? await ctx.supabase.from("charges").select("id, lease_id, type, description, period_start, due_date, amount_minor, paid_minor, currency, status").in("lease_id", leaseIds as string[]).eq("org_id", ctx.orgId).order("due_date", { ascending: false })
    : { data: [] as never[] };

  const { data: documentRows } = await ctx.supabase.from("documents").select("id, entity_type, entity_id, kind, path, expires_on, created_at").eq("entity_type", "tenant").eq("entity_id", tenant.id).eq("org_id", ctx.orgId);
  const { data: leaseDocuments } = leaseIds.length
    ? await ctx.supabase.from("documents").select("id, entity_type, entity_id, kind, path, expires_on, created_at").eq("entity_type", "lease").in("entity_id", leaseIds as string[]).eq("org_id", ctx.orgId)
    : { data: [] as never[] };

  return {
    tenant: { id: tenant.id, full_name: tenant.full_name, phone: tenant.phone, email: tenant.email, language: tenant.language },
    leases,
    charges: (chargeRows ?? []) as unknown[],
    payments: (paymentRows.data ?? []) as unknown[],
    credits: (creditRows.data ?? []) as unknown[],
    requests: (requestRows.data ?? []) as unknown[],
    documents: [...(documentRows ?? []), ...(leaseDocuments ?? [])] as unknown[],
  };
}

export async function createTenantMaintenance(ctx: Ctx, body: Record<string, unknown>) {
  const { data: tenantRows } = await ctx.supabase.from("tenants").select("id").eq("user_id", ctx.userId).eq("org_id", ctx.orgId).limit(1);
  const tenant = tenantRows?.[0];
  if (!tenant) throw new Error("no_tenant");

  const { data: leaseRows } = await ctx.supabase.from("leases").select("id, unit_id, room_id").eq("tenant_id", tenant.id).eq("org_id", ctx.orgId).limit(1);
  const lease = leaseRows?.[0];
  if (!lease) throw new Error("no_lease");

  let buildingId: string | null = null;
  if (lease.unit_id) {
    const { data: unitRows } = await ctx.supabase.from("units").select("building_id").eq("id", lease.unit_id).limit(1);
    buildingId = (unitRows?.[0] as { building_id: string } | undefined)?.building_id ?? null;
  }
  if (!buildingId) throw new Error("no_building");

  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 200) : "Maintenance request (via bot)";
  const description = typeof body?.description === "string" ? body.description.slice(0, 2000) : null;
  const priority = (["low", "normal", "high", "urgent"].includes(body?.priority as string) ? body.priority : "normal") as "low" | "normal" | "high" | "urgent";

  const { data, error } = await ctx.supabase.from("maintenance_requests").insert({
    org_id: ctx.orgId,
    building_id: buildingId,
    unit_id: lease.unit_id,
    room_id: lease.room_id,
    tenant_id: tenant.id,
    title,
    description,
    priority,
    status: "open",
    opened_at: new Date().toISOString(),
  }).select("id").single();
  if (error || !data) throw new Error("create_failed");
  return { ok: true, id: data.id };
}
