"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toMinor } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/server/org-context";

export type PortalState = {
  error?: string;
  ok?: string;
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

const proofSchema = z.object({
  amount: z.string().min(1),
  method: z.enum(["cash", "bank_transfer", "cheque", "card", "online"]),
  receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

const requestSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  category: z.string().trim().min(1).max(40).default("general"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

function fail(error: string): PortalState {
  return { error };
}

/**
 * A tenant uploads proof of a transfer. The payment waits as `pending_confirmation`
 * until staff confirm it (SPEC §8 T1); it is not a posted receipt.
 */
export async function submitPaymentProofAction(
  _prev: PortalState,
  formData: FormData,
): Promise<PortalState> {
  const ctx = await getOrgContext();
  if (!ctx || ctx.role !== "tenant") return fail("not_authorised");

  const parsed = proofSchema.safeParse({
    amount: formData.get("amount"),
    method: formData.get("method"),
    receivedOn: formData.get("receivedOn"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return fail("invalid_input");

  const file = formData.get("proof");
  if (!(file instanceof File) || file.size === 0) return fail("proof_required");
  if (file.size > MAX_UPLOAD_BYTES) return fail("file_too_large");
  if (!ALLOWED_TYPES.includes(file.type)) return fail("unsupported_file_type");

  let amountMinor: bigint;
  try {
    amountMinor = toMinor(parsed.data.amount, "QAR");
  } catch {
    return fail("invalid_amount");
  }
  if (amountMinor <= 0n) return fail("amount_must_be_positive");

  const { data: tenantRows } = await ctx.supabase
    .from("tenants")
    .select("id")
    .eq("user_id", ctx.userId)
    .limit(1);
  const tenant = tenantRows?.[0];
  if (!tenant) return fail("no_tenant_profile");

  const { data: leases } = await ctx.supabase
    .from("leases")
    .select("id")
    .eq("tenant_id", tenant.id)
    .order("start_date", { ascending: false })
    .limit(1);
  const leaseId = leases?.[0]?.id ?? null;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${ctx.orgId}/payment_proof/${tenant.id}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await ctx.supabase.storage
    .from("documents")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return fail("upload_failed");

  const { error: insertError } = await ctx.supabase.from("payments").insert({
    org_id: ctx.orgId,
    tenant_id: tenant.id,
    lease_id: leaseId,
    amount_minor: Number(amountMinor),
    currency: "QAR",
    method: parsed.data.method,
    received_at: new Date(parsed.data.receivedOn).toISOString(),
    reference: parsed.data.note || null,
    proof_path: path,
    status: "pending_confirmation",
    created_by: ctx.userId,
  });
  if (insertError) {
    await ctx.supabase.storage.from("documents").remove([path]);
    return fail("payment_failed");
  }

  revalidatePath("/portal/payments");
  revalidatePath("/portal");
  return { ok: "proof_submitted" };
}

/** A tenant raises a maintenance request against their own lease. */
export async function createTenantRequestAction(
  _prev: PortalState,
  formData: FormData,
): Promise<PortalState> {
  const ctx = await getOrgContext();
  if (!ctx || ctx.role !== "tenant") return fail("not_authorised");

  const parsed = requestSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    category: formData.get("category") || "general",
    priority: formData.get("priority") || "normal",
  });
  if (!parsed.success) return fail("invalid_input");

  const { data: tenantRows } = await ctx.supabase
    .from("tenants")
    .select("id")
    .eq("user_id", ctx.userId)
    .limit(1);
  const tenant = tenantRows?.[0];
  if (!tenant) return fail("no_tenant_profile");

  const { data: leases } = await ctx.supabase
    .from("leases")
    .select("id, unit_id, room_id")
    .eq("tenant_id", tenant.id)
    .order("start_date", { ascending: false })
    .limit(1);
  const lease = leases?.[0];
  if (!lease) return fail("no_active_lease");

  const buildingId = await buildingForLease(ctx.supabase, lease.unit_id, lease.room_id);
  if (!buildingId) return fail("no_active_lease");

  const { data: requestId, error } = await ctx.supabase.rpc("create_maintenance_request", {
    p_building_id: buildingId,
    p_title: parsed.data.title,
    p_description: parsed.data.description ?? null,
    p_unit_id: lease.unit_id ?? null,
    p_room_id: lease.room_id ?? null,
    p_tenant_id: tenant.id,
    p_category: parsed.data.category,
    p_priority: parsed.data.priority,
    p_assigned_vendor_id: null,
  });
  if (error || !requestId) return fail(error?.message || "request_failed");

  revalidatePath("/portal/requests");
  return { ok: "request_created" };
}

async function buildingForLease(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  unitId: string | null,
  roomId: string | null,
): Promise<string | null> {
  if (unitId) {
    const { data } = await supabase
      .from("units")
      .select("building_id")
      .eq("id", unitId)
      .maybeSingle();
    return data?.building_id ?? null;
  }
  if (roomId) {
    const { data } = await supabase
      .from("rooms")
      .select("units(building_id)")
      .eq("id", roomId)
      .maybeSingle();
    const unit = data?.units as unknown as { building_id: string } | null;
    return unit?.building_id ?? null;
  }
  return null;
}
