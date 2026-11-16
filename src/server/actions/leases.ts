"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toMinor } from "@/lib/money";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

export type LeaseState = {
  error?: string;
  ok?: string;
  leaseId?: string;
  newLeaseId?: string;
};

const createLeaseSchema = z.object({
  unitId: z.string().uuid().optional().or(z.literal("")),
  roomId: z.string().uuid().optional().or(z.literal("")),
  tenantId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rent: z.string().min(1),
  currency: z.string().length(3).default("QAR"),
  frequency: z.enum(["monthly", "quarterly", "semiannual", "annual"]),
  installments: z.coerce.number().int().min(1).default(1),
  dueDay: z.coerce.number().int().min(1).max(28).default(1),
  deposit: z.string().optional().or(z.literal("")),
  noticeDays: z.coerce.number().int().min(0).default(60),
  isSublet: z.coerce.boolean().default(false),
  parentLeaseId: z.string().uuid().optional().or(z.literal("")),
  leaseNo: z.string().trim().max(50).optional().or(z.literal("")),
});

function fail(error: string): LeaseState {
  return { error };
}

export async function createLeaseAction(
  _prev: LeaseState,
  formData: FormData,
): Promise<LeaseState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "leases.write")) return fail("not_authorised");

  const rawUnitId = formData.get("unitId") as string | null;
  const rawRoomId = formData.get("roomId") as string | null;

  const parsed = createLeaseSchema.safeParse({
    unitId: rawUnitId || undefined,
    roomId: rawRoomId || undefined,
    tenantId: formData.get("tenantId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    rent: formData.get("rent"),
    currency: formData.get("currency") || "QAR",
    frequency: formData.get("frequency"),
    installments: formData.get("installments"),
    dueDay: formData.get("dueDay"),
    deposit: formData.get("deposit") || undefined,
    noticeDays: formData.get("noticeDays"),
    isSublet: formData.get("isSublet") === "true" || formData.get("isSublet") === "on",
    parentLeaseId: formData.get("parentLeaseId") || undefined,
    leaseNo: formData.get("leaseNo") || undefined,
  });

  if (!parsed.success) return fail("invalid_input");

  const {
    unitId,
    roomId,
    tenantId,
    startDate,
    endDate,
    rent,
    currency,
    frequency,
    installments,
    dueDay,
    deposit,
    noticeDays,
    isSublet,
    parentLeaseId,
    leaseNo,
  } = parsed.data;

  if ((unitId ? 1 : 0) + (roomId ? 1 : 0) !== 1) {
    return fail("invalid_input");
  }

  if (endDate <= startDate) {
    return fail("invalid_input");
  }

  if (isSublet && !parentLeaseId) {
    return fail("invalid_input");
  }

  let rentMinor: bigint;
  let depositMinor: bigint = 0n;
  try {
    rentMinor = toMinor(rent, currency);
    if (deposit) {
      depositMinor = toMinor(deposit, currency);
    }
  } catch {
    return fail("invalid_input");
  }

  const generatedNo =
    leaseNo ||
    `LSE-${startDate.slice(0, 4)}-${Math.floor(10000 + Math.random() * 90000)}`;

  const { data, error } = await ctx.supabase
    .from("leases")
    .insert({
      org_id: ctx.orgId,
      lease_no: generatedNo,
      unit_id: unitId || null,
      room_id: roomId || null,
      tenant_id: tenantId,
      parent_lease_id: isSublet && parentLeaseId ? parentLeaseId : null,
      start_date: startDate,
      end_date: endDate,
      rent_minor: Number(rentMinor),
      currency,
      payment_frequency: frequency,
      installments,
      due_day: dueDay,
      deposit_minor: Number(depositMinor),
      rent_collected_by: isSublet ? "main_tenant" : "landlord",
      notice_days: noticeDays,
      status: "draft",
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return fail("duplicate_code");
    return fail("failed");
  }

  revalidatePath("/[locale]/leases", "page");
  return { ok: "created", leaseId: data.id };
}

export async function activateLeaseAction(leaseId: string): Promise<LeaseState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "leases.write")) return fail("not_authorised");

  const { error } = await ctx.supabase.rpc("activate_lease", {
    p_lease: leaseId,
  });

  if (error) {
    if (error.message.includes("sub-let needs approval")) return fail("sublet_needs_approval");
    if (error.message.includes("already leased") || error.message.includes("overlap") || error.code === "23P01") {
      return fail("unit_already_leased");
    }
    return fail(error.message || "failed");
  }

  revalidatePath("/[locale]/leases", "page");
  revalidatePath(`/[locale]/leases/${leaseId}`, "page");
  return { ok: "activated" };
}

export async function terminateLeaseAction(
  leaseId: string,
  date: string,
  reason: string,
): Promise<LeaseState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "leases.write")) return fail("not_authorised");

  const { error } = await ctx.supabase.rpc("terminate_lease", {
    p_lease: leaseId,
    p_date: date,
    p_reason: reason,
  });

  if (error) {
    return fail(error.message || "failed");
  }

  revalidatePath("/[locale]/leases", "page");
  revalidatePath(`/[locale]/leases/${leaseId}`, "page");
  return { ok: "terminated" };
}

export async function renewLeaseAction(
  leaseId: string,
  formData: FormData,
): Promise<LeaseState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "leases.write")) return fail("not_authorised");

  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const rent = formData.get("rent") as string;
  const currency = (formData.get("currency") as string) || "QAR";
  const frequency = formData.get("frequency") as string;
  const installments = Number(formData.get("installments") || 1);
  const dueDay = Number(formData.get("dueDay") || 1);
  const deposit = formData.get("deposit") as string | null;

  let rentMinor: bigint;
  let depositMinor = 0n;
  try {
    rentMinor = toMinor(rent, currency);
    if (deposit) depositMinor = toMinor(deposit, currency);
  } catch {
    return fail("invalid_input");
  }

  const terms = {
    start_date: startDate,
    end_date: endDate,
    rent_minor: Number(rentMinor),
    payment_frequency: frequency,
    installments,
    due_day: dueDay,
    deposit_minor: Number(depositMinor),
  };

  const { data: newLeaseId, error } = await ctx.supabase.rpc("renew_lease", {
    p_lease: leaseId,
    p_terms: terms,
  });

  if (error || !newLeaseId) {
    return fail(error?.message || "failed");
  }

  revalidatePath("/[locale]/leases", "page");
  revalidatePath(`/[locale]/leases/${leaseId}`, "page");
  return { ok: "renewed", newLeaseId };
}

export async function approveSubletAction(leaseId: string): Promise<LeaseState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "leases.approve")) return fail("not_authorised");

  const { error } = await ctx.supabase
    .from("leases")
    .update({
      sublet_approved_by: ctx.userId,
      sublet_approved_at: new Date().toISOString(),
    })
    .eq("id", leaseId)
    .eq("org_id", ctx.orgId)
    .not("parent_lease_id", "is", null);

  if (error) {
    return fail("failed");
  }

  revalidatePath(`/[locale]/leases/${leaseId}`, "page");
  return { ok: "approved" };
}
