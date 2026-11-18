import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Read model for the tenant portal. Every query goes through the user-scoped client,
 * so RLS decides what the signed-in tenant sees (SPEC §6: tenant self-access).
 */

export type PortalLease = {
  id: string;
  lease_no: string;
  start_date: string;
  end_date: string;
  rent_minor: number;
  currency: string;
  status: string;
  payment_frequency: string;
  due_day: number;
  deposit_minor: number;
  unit_no: string | null;
  room_no: string | null;
  building_code: string | null;
  building_name: string | null;
};

export type PortalCharge = {
  id: string;
  lease_id: string;
  type: string;
  description: string | null;
  period_start: string | null;
  due_date: string;
  amount_minor: number;
  paid_minor: number;
  currency: string;
  status: string;
};

export type PortalPayment = {
  id: string;
  receipt_no: number | null;
  receipt_year: number | null;
  amount_minor: number;
  currency: string;
  method: string;
  received_at: string;
  reference: string | null;
  status: string;
  proof_path: string | null;
};

export type PortalCredit = {
  id: string;
  amount_minor: number;
  remaining_minor: number;
  currency: string;
  note: string | null;
};

export type PortalRequest = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  opened_at: string;
  resolved_at: string | null;
};

export type PortalDocument = {
  id: string;
  entity_type: string;
  entity_id: string;
  kind: string;
  path: string;
  expires_on: string | null;
  created_at: string;
};

export type TenantPortalData = {
  tenant: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    language: string;
  } | null;
  leases: PortalLease[];
  charges: PortalCharge[];
  payments: PortalPayment[];
  credits: PortalCredit[];
  requests: PortalRequest[];
  documents: PortalDocument[];
};

const EMPTY: TenantPortalData = {
  tenant: null,
  leases: [],
  charges: [],
  payments: [],
  credits: [],
  requests: [],
  documents: [],
};

export const getTenantPortalData = cache(async (): Promise<TenantPortalData | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tenantRows } = await supabase
    .from("tenants")
    .select("id, full_name, phone, email, language")
    .eq("user_id", user.id)
    .limit(1);

  const tenant = tenantRows?.[0];
  if (!tenant) return EMPTY;

  const [
    { data: leaseRows },
    { data: paymentRows },
    { data: creditRows },
    { data: requestRows },
  ] = await Promise.all([
    supabase
      .from("leases")
      .select(
        "id, lease_no, start_date, end_date, rent_minor, currency, status, payment_frequency, due_day, deposit_minor, unit_id, room_id, units(unit_no, buildings(code, name)), rooms(room_no)",
      )
      .eq("tenant_id", tenant.id)
      .order("start_date", { ascending: false }),
    supabase
      .from("payments")
      .select(
        "id, receipt_no, receipt_year, amount_minor, currency, method, received_at, reference, status, proof_path",
      )
      .eq("tenant_id", tenant.id)
      .order("received_at", { ascending: false }),
    supabase
      .from("tenant_credits")
      .select("id, amount_minor, remaining_minor, currency, note")
      .eq("tenant_id", tenant.id),
    supabase
      .from("maintenance_requests")
      .select("id, title, description, category, priority, status, opened_at, resolved_at")
      .eq("tenant_id", tenant.id)
      .order("opened_at", { ascending: false }),
  ]);

  const leases: PortalLease[] = (leaseRows ?? []).map((l) => {
    const unit = l.units as unknown as
      | { unit_no: string; buildings: { code: string; name: string } | null }
      | null;
    const room = l.rooms as unknown as { room_no: string } | null;
    return {
      id: l.id,
      lease_no: l.lease_no,
      start_date: l.start_date,
      end_date: l.end_date,
      rent_minor: l.rent_minor,
      currency: l.currency,
      status: l.status,
      payment_frequency: l.payment_frequency,
      due_day: l.due_day,
      deposit_minor: l.deposit_minor,
      unit_no: unit?.unit_no ?? null,
      room_no: room?.room_no ?? null,
      building_code: unit?.buildings?.code ?? null,
      building_name: unit?.buildings?.name ?? null,
    };
  });

  const leaseIds = leases.map((l) => l.id);

  const { data: chargeRows } = leaseIds.length
    ? await supabase
        .from("charges")
        .select(
          "id, lease_id, type, description, period_start, due_date, amount_minor, paid_minor, currency, status",
        )
        .in("lease_id", leaseIds)
        .order("due_date", { ascending: false })
    : { data: [] as never[] };

  const { data: documentRows } = await supabase
    .from("documents")
    .select("id, entity_type, entity_id, kind, path, expires_on, created_at")
    .eq("entity_type", "tenant")
    .eq("entity_id", tenant.id);

  const { data: leaseDocuments } = leaseIds.length
    ? await supabase
        .from("documents")
        .select("id, entity_type, entity_id, kind, path, expires_on, created_at")
        .eq("entity_type", "lease")
        .in("entity_id", leaseIds)
    : { data: [] as never[] };

  return {
    tenant: {
      id: tenant.id,
      full_name: tenant.full_name,
      phone: tenant.phone,
      email: tenant.email,
      language: tenant.language,
    },
    leases,
    charges: (chargeRows ?? []) as PortalCharge[],
    payments: (paymentRows ?? []) as PortalPayment[],
    credits: (creditRows ?? []) as PortalCredit[],
    requests: (requestRows ?? []) as PortalRequest[],
    documents: [...(documentRows ?? []), ...(leaseDocuments ?? [])] as PortalDocument[],
  };
});
