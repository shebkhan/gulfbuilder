"use server";

import { getOrgContext } from "@/server/org-context";

export type PortfolioKpis = {
  total_units: number;
  occupied_units: number;
  vacant_units: number;
  occupancy_pct: number;
  monthly_rent_roll: number;
  ytd_collections: number;
  ytd_expenses: number;
  net_operating_income: number;
  overdue_receivables: number;
};

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
    .select(`
      lease_no,
      start_date,
      end_date,
      rent_minor,
      currency,
      status,
      tenants ( full_name ),
      units ( unit_no, buildings ( name, code ) )
    `)
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
    .select(`
      amount_minor,
      paid_minor,
      currency,
      due_date,
      leases (
        lease_no,
        tenants ( full_name )
      )
    `)
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
