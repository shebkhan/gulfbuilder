import type { SupabaseClient } from "@supabase/supabase-js";
import { dashboardSchema, type DashboardKpis, type DashboardData } from "@/schemas/dashboard";
import type { Database } from "@/types/database";

type ServiceContext = { supabase: SupabaseClient<Database> };

type ChequeRow = {
  id: string;
  cheque_no: string;
  bank_name: string | null;
  amount_minor: number;
  currency: string;
  cheque_date: string;
  status: string;
  tenants: { full_name: string } | null;
};

type PaymentRow = {
  id: string;
  receipt_no: number;
  receipt_year: number;
  amount_minor: number;
  currency: string;
  method: string;
  received_at: string;
  tenants: { full_name: string } | null;
};

type MaintenanceRow = {
  id: string;
  title: string;
  priority: string;
  status: string;
  opened_at: string;
  buildings: { code: string } | null;
  units: { unit_no: string } | null;
};

type BuildingRow = {
  id: string;
  code: string;
  name: string;
  units: { id: string; status: string }[];
};

/**
 * One screen, one round trip. The web page calls this in-process; `/api/v1/dashboard`
 * exposes the same shape to mobile, so the two can never drift.
 */
export async function getDashboard(ctx: ServiceContext): Promise<DashboardData> {
  const next30Days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [kpis, expiring, maintenanceCount, cheques, payments, maintenance, buildings] =
    await Promise.all([
      ctx.supabase.rpc("get_portfolio_kpis"),
      ctx.supabase.rpc("leases_expiring", { p_days: 30 }),
      ctx.supabase
        .from("maintenance_requests")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "in_progress"]),
      ctx.supabase
        .from("cheques")
        .select(
          "id, cheque_no, bank_name, amount_minor, currency, cheque_date, status, tenants(full_name)",
        )
        .in("status", ["received", "deposited"])
        .lte("cheque_date", next30Days)
        .order("cheque_date", { ascending: true })
        .limit(4),
      ctx.supabase
        .from("payments")
        .select(
          "id, receipt_no, receipt_year, amount_minor, currency, method, received_at, tenants(full_name)",
        )
        .order("received_at", { ascending: false })
        .limit(4),
      ctx.supabase
        .from("maintenance_requests")
        .select("id, title, priority, status, opened_at, buildings(code), units(unit_no)")
        .in("status", ["open", "in_progress"])
        .order("opened_at", { ascending: false })
        .limit(4),
      ctx.supabase
        .from("buildings")
        .select("id, code, name, units(id, status)")
        .is("deleted_at", null)
        .order("code"),
    ]);

  return dashboardSchema.parse({
    kpis: (kpis.data as unknown as DashboardKpis | null) ?? null,
    expiringLeases: (expiring.data ?? []) as unknown,
    openMaintenance: maintenanceCount.count ?? 0,
    upcomingCheques: ((cheques.data ?? []) as unknown as ChequeRow[]).map((row) => ({
      id: row.id,
      cheque_no: row.cheque_no,
      bank_name: row.bank_name,
      amount_minor: row.amount_minor,
      currency: row.currency,
      cheque_date: row.cheque_date,
      status: row.status,
      tenant_name: row.tenants?.full_name ?? null,
    })),
    recentPayments: ((payments.data ?? []) as unknown as PaymentRow[]).map((row) => ({
      id: row.id,
      receipt_no: row.receipt_no,
      receipt_year: row.receipt_year,
      amount_minor: row.amount_minor,
      currency: row.currency,
      method: row.method,
      received_at: row.received_at,
      tenant_name: row.tenants?.full_name ?? null,
    })),
    recentMaintenance: ((maintenance.data ?? []) as unknown as MaintenanceRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      priority: row.priority,
      status: row.status,
      opened_at: row.opened_at,
      building_code: row.buildings?.code ?? null,
      unit_no: row.units?.unit_no ?? null,
    })),
    buildings: ((buildings.data ?? []) as unknown as BuildingRow[]).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      units: (row.units ?? []).map((unit) => ({ id: unit.id, status: unit.status })),
    })),
  });
}
