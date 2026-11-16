import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Read model for the owner portal (SPEC §8 O1). The signed-in user is the owner;
 * every query is additionally narrowed to their own buildings, leases and tenants.
 */

export type OwnerScope = {
  ownerIds: string[];
  buildingIds: string[];
  leaseIds: string[];
  tenantIds: string[];
  currency: string;
};

export async function getOwnerScope(): Promise<OwnerScope | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: owners } = await supabase
    .from("owners")
    .select("id")
    .eq("user_id", user.id);
  const ownerIds = (owners ?? []).map((o) => o.id);

  const { data: org } = await supabase
    .from("organizations")
    .select("base_currency")
    .limit(1)
    .maybeSingle();

  if (ownerIds.length === 0) {
    return {
      ownerIds: [],
      buildingIds: [],
      leaseIds: [],
      tenantIds: [],
      currency: org?.base_currency ?? "QAR",
    };
  }

  const { data: buildings } = await supabase
    .from("buildings")
    .select("id")
    .in("owner_id", ownerIds);
  const buildingIds = (buildings ?? []).map((b) => b.id);

  const { data: units } = buildingIds.length
    ? await supabase.from("units").select("id").in("building_id", buildingIds)
    : { data: [] as never[] };
  const unitIds = (units ?? []).map((u) => u.id);

  const { data: rooms } = unitIds.length
    ? await supabase.from("rooms").select("id").in("unit_id", unitIds)
    : { data: [] as never[] };
  const roomIds = (rooms ?? []).map((r) => r.id);

  const { data: leases } =
    unitIds.length || roomIds.length
      ? await supabase
          .from("leases")
          .select("id, tenant_id, unit_id, room_id")
          .or(
            [
              unitIds.length ? `unit_id.in.(${unitIds.join(",")})` : null,
              roomIds.length ? `room_id.in.(${roomIds.join(",")})` : null,
            ]
              .filter(Boolean)
              .join(","),
          )
      : { data: [] as never[] };

  const allLeases = leases ?? [];
  const leaseIds = allLeases.map((l) => l.id);
  const tenantIds = [...new Set(allLeases.map((l) => l.tenant_id).filter(Boolean))] as string[];

  return {
    ownerIds,
    buildingIds,
    leaseIds,
    tenantIds,
    currency: org?.base_currency ?? "QAR",
  };
}

export type OwnerDashboard = {
  totalUnits: number;
  occupiedUnits: number;
  expectedThisMonth: bigint;
  collectedThisMonth: bigint;
  arrears: bigint;
  noiYearToDate: bigint;
  upcomingCheques: {
    id: string;
    cheque_no: string;
    bank_name: string | null;
    amount_minor: number;
    currency: string;
    cheque_date: string;
    status: string;
  }[];
  openMaintenance: number;
  expiringLeases: { id: string; lease_no: string; end_date: string; tenant_name: string }[];
  nextPayout: { amount_minor: number; currency: string; paid_on: string } | null;
  closingBalance: bigint;
};

export async function getOwnerDashboard(scope: OwnerScope): Promise<OwnerDashboard> {
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const yearStart = `${now.getUTCFullYear()}-01-01`;

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

  const [
    { data: units },
    { data: charges },
    { data: payments },
    { data: expenses },
    { data: cheques },
    { count: openMaintenance },
    { data: statements },
    { data: payouts },
  ] = await Promise.all([
    supabase.from("units").select("id, status").in("building_id", scope.buildingIds),
    scope.leaseIds.length
      ? supabase
          .from("charges")
          .select("id, due_date, amount_minor, paid_minor, currency, status")
          .in("lease_id", scope.leaseIds)
          .gte("due_date", yearStart)
      : Promise.resolve({ data: [] as never[] }),
    scope.leaseIds.length
      ? supabase
          .from("payments")
          .select("id, received_at, amount_minor, currency, status")
          .in("lease_id", scope.leaseIds)
          .gte("received_at", yearStart)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("expenses")
      .select("id, amount_minor, currency, status, expense_date")
      .in("building_id", scope.buildingIds)
      .eq("status", "paid"),
    scope.leaseIds.length
      ? supabase
          .from("cheques")
          .select("id, cheque_no, bank_name, amount_minor, currency, cheque_date, status")
          .in("lease_id", scope.leaseIds)
          .in("status", ["received", "deposited"])
          .order("cheque_date", { ascending: true })
          .limit(6)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("maintenance_requests")
      .select("id", { count: "exact", head: true })
      .in("building_id", scope.buildingIds)
      .in("status", ["open", "assigned", "in_progress"]),
    scope.ownerIds.length
      ? supabase
          .from("owner_statements")
          .select("id, status, period_start, period_end, closing_minor, currency")
          .in("owner_id", scope.ownerIds)
          .order("period_start", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    scope.ownerIds.length
      ? supabase
          .from("owner_payouts")
          .select("id, amount_minor, currency, paid_on")
          .in("owner_id", scope.ownerIds)
          .order("paid_on", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const expectedThisMonth = (charges ?? [])
    .filter((c) => c.due_date >= monthStart)
    .reduce((acc, c) => acc + BigInt(c.amount_minor), 0n);
  const collectedThisMonth = (payments ?? [])
    .filter((p) => p.received_at.slice(0, 10) >= monthStart)
    .reduce((acc, p) => acc + BigInt(p.amount_minor), 0n);
  const arrears = (charges ?? [])
    .filter((c) => c.status === "overdue")
    .reduce((acc, c) => acc + BigInt(c.amount_minor - c.paid_minor), 0n);
  const collectedYtd = (payments ?? []).reduce((acc, p) => acc + BigInt(p.amount_minor), 0n);
  const expensesYtd = (expenses ?? []).reduce((acc, e) => acc + BigInt(e.amount_minor), 0n);

  const { data: expiring } = scope.leaseIds.length
    ? await supabase
        .from("leases")
        .select("id, lease_no, end_date, tenants(full_name)")
        .in("id", scope.leaseIds)
        .gte("end_date", now.toISOString().slice(0, 10))
        .lte("end_date", new Date(now.getTime() + 90 * 86400000).toISOString().slice(0, 10))
        .order("end_date", { ascending: true })
    : { data: [] as never[] };

  const lastStatement = (statements ?? [])[0];

  return {
    totalUnits: (units ?? []).length,
    occupiedUnits: (units ?? []).filter((u) => u.status === "occupied").length,
    expectedThisMonth,
    collectedThisMonth,
    arrears,
    noiYearToDate: collectedYtd - expensesYtd,
    upcomingCheques: (cheques ?? []) as OwnerDashboard["upcomingCheques"],
    openMaintenance: openMaintenance ?? 0,
    expiringLeases: (expiring ?? []).map((l) => {
      const tenant = l.tenants as unknown as { full_name: string } | null;
      return {
        id: l.id,
        lease_no: l.lease_no,
        end_date: l.end_date,
        tenant_name: tenant?.full_name ?? "",
      };
    }),
    nextPayout: (payouts ?? [])[0]
      ? {
          amount_minor: (payouts ?? [])[0]!.amount_minor,
          currency: (payouts ?? [])[0]!.currency,
          paid_on: (payouts ?? [])[0]!.paid_on,
        }
      : null,
    closingBalance: BigInt(lastStatement?.closing_minor ?? 0),
  };
}

export type OwnerRentRollRow = {
  id: string;
  lease_no: string;
  tenant_name: string;
  unit_no: string | null;
  building_code: string | null;
  start_date: string;
  end_date: string;
  rent_minor: number;
  currency: string;
  deposit_minor: number;
  paid_minor: number;
  status: string;
};

export async function getOwnerRentRoll(scope: OwnerScope): Promise<OwnerRentRollRow[]> {
  if (scope.leaseIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("leases")
    .select(
      "id, lease_no, start_date, end_date, rent_minor, currency, deposit_minor, status, tenants(full_name), units(unit_no, buildings(code))",
    )
    .in("id", scope.leaseIds)
    .order("end_date", { ascending: true });

  const rows = data ?? [];
  const charges = rows.length
    ? await supabase
        .from("charges")
        .select("lease_id, paid_minor")
        .in("lease_id", scope.leaseIds)
    : { data: [] as never[] };

  const paidByLease = new Map<string, number>();
  for (const c of charges.data ?? []) {
    paidByLease.set(
      c.lease_id,
      (paidByLease.get(c.lease_id) ?? 0) + (c.paid_minor ?? 0),
    );
  }

  return rows.map((l) => {
    const tenant = l.tenants as unknown as { full_name: string } | null;
    const unit = l.units as unknown as { unit_no: string; buildings: { code: string } | null } | null;
    return {
      id: l.id,
      lease_no: l.lease_no,
      tenant_name: tenant?.full_name ?? "",
      unit_no: unit?.unit_no ?? null,
      building_code: unit?.buildings?.code ?? null,
      start_date: l.start_date,
      end_date: l.end_date,
      rent_minor: l.rent_minor,
      currency: l.currency,
      deposit_minor: l.deposit_minor,
      paid_minor: paidByLease.get(l.id) ?? 0,
      status: l.status,
    };
  });
}

export type OwnerReceivableRow = {
  tenant_name: string;
  building_code: string | null;
  due_date: string;
  days_overdue: number;
  amount_minor: number;
  currency: string;
};

export async function getOwnerReceivables(scope: OwnerScope): Promise<OwnerReceivableRow[]> {
  if (scope.leaseIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("charges")
    .select(
      "id, due_date, amount_minor, paid_minor, currency, status, leases(lease_no, tenants(full_name), units(unit_no, buildings(code)))",
    )
    .in("lease_id", scope.leaseIds)
    .in("status", ["pending", "partial", "overdue"])
    .order("due_date", { ascending: true });

  const today = Date.now();
  return (data ?? []).map((c) => {
    const lease = c.leases as unknown as {
      lease_no: string;
      tenants: { full_name: string } | null;
      units: { unit_no: string; buildings: { code: string } | null } | null;
    } | null;
    const days = Math.max(
      0,
      Math.floor((today - new Date(c.due_date).getTime()) / 86400000),
    );
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

export async function getOwnerStatements(scope: OwnerScope) {
  if (scope.ownerIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("owner_statements")
    .select(
      "id, period_start, period_end, currency, status, opening_minor, closing_minor, totals, issued_at",
    )
    .in("owner_id", scope.ownerIds)
    .order("period_start", { ascending: false });
  return data ?? [];
}

export async function getOwnerPayouts(scope: OwnerScope) {
  if (scope.ownerIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("owner_payouts")
    .select("id, amount_minor, currency, paid_on, method, reference, owner_statements(period_start, period_end)")
    .in("owner_id", scope.ownerIds)
    .order("paid_on", { ascending: false });
  return data ?? [];
}

export async function getOwnerApprovals(scope: OwnerScope) {
  if (scope.ownerIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("owner_expense_approvals")
    .select(
      "id, expense_id, owner_id, status, requested_at, decided_at, note, expenses(id, category, description, amount_minor, currency, status, expense_date, buildings(code))",
    )
    .in("owner_id", scope.ownerIds)
    .order("requested_at", { ascending: false });
  return data ?? [];
}

export async function getOwnerDocuments(scope: OwnerScope) {
  if (scope.buildingIds.length === 0 && scope.leaseIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();

  const buildingDocs = scope.buildingIds.length
    ? await supabase
        .from("documents")
        .select("id, entity_type, entity_id, kind, path, expires_on, created_at")
        .eq("entity_type", "building")
        .in("entity_id", scope.buildingIds)
    : { data: [] as never[] };

  const leaseDocs = scope.leaseIds.length
    ? await supabase
        .from("documents")
        .select("id, entity_type, entity_id, kind, path, expires_on, created_at")
        .eq("entity_type", "lease")
        .in("entity_id", scope.leaseIds)
    : { data: [] as never[] };

  return [...(buildingDocs.data ?? []), ...(leaseDocs.data ?? [])];
}
