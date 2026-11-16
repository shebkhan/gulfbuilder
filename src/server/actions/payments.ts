"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toMinor } from "@/lib/money";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";
import type { Database } from "@/types/database";

export type PaymentState = {
  error?: string;
  ok?: string;
  paymentId?: string;
};

type PaymentMethod = Database["public"]["Enums"]["payment_method"];

const recordPaymentSchema = z.object({
  tenantId: z.string().uuid(),
  leaseId: z.string().uuid().optional().or(z.literal("")),
  amount: z.string().min(1),
  currency: z.string().length(3).default("QAR"),
  method: z.enum(["cash", "bank_transfer", "cheque", "card", "online"]),
  receivedAt: z.string().min(1),
  reference: z.string().trim().max(100).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  allocations: z.string().optional().or(z.literal("")),
});

function fail(error: string): PaymentState {
  return { error };
}

export async function recordPaymentAction(
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const ctx = await getOrgContext();
  if (!ctx || (!can(ctx.role, "finance.write") && ctx.role !== "manager")) {
    return fail("not_authorised");
  }

  const parsed = recordPaymentSchema.safeParse({
    tenantId: formData.get("tenantId"),
    leaseId: formData.get("leaseId") || undefined,
    amount: formData.get("amount"),
    currency: formData.get("currency") || "QAR",
    method: formData.get("method"),
    receivedAt: formData.get("receivedAt") || new Date().toISOString(),
    reference: formData.get("reference") || undefined,
    notes: formData.get("notes") || undefined,
    allocations: formData.get("allocations") || undefined,
  });

  if (!parsed.success) {
    return fail("invalid_input");
  }

  const {
    tenantId,
    leaseId,
    amount,
    currency,
    method,
    receivedAt,
    reference,
    notes,
    allocations: rawAllocations,
  } = parsed.data;

  let amountMinor: bigint;
  try {
    amountMinor = toMinor(amount, currency);
    if (amountMinor <= 0n) return fail("amount_must_be_positive");
  } catch {
    return fail("invalid_amount");
  }

  type AllocItem = { charge_id: string; amount: number };
  let parsedAllocations: AllocItem[] = [];
  if (rawAllocations) {
    try {
      const arr = JSON.parse(rawAllocations);
      if (Array.isArray(arr)) {
        parsedAllocations = arr.map((item: { chargeId?: string; charge_id?: string; amount: string | number }) => {
          const cid = item.chargeId || item.charge_id;
          if (!cid) throw new Error("missing charge_id");
          const minor = typeof item.amount === "string" ? Number(toMinor(item.amount, currency)) : Number(item.amount);
          return { charge_id: cid, amount: minor };
        });
      }
    } catch {
      return fail("invalid_allocations");
    }
  }

  const { data: paymentId, error } = await ctx.supabase.rpc("record_payment", {
    p_tenant_id: tenantId,
    p_amount: Number(amountMinor),
    p_currency: currency,
    p_method: method as PaymentMethod,
    p_received_at: new Date(receivedAt).toISOString(),
    p_reference: reference || undefined,
    p_notes: notes || undefined,
    p_lease_id: leaseId || undefined,
    p_allocations: parsedAllocations,
  });

  if (error || !paymentId) {
    return fail(error?.message || "payment_failed");
  }

  revalidatePath("/payments");
  if (leaseId) {
    revalidatePath(`/leases/${leaseId}`);
  }
  revalidatePath("/dashboard");

  return { ok: "payment_recorded", paymentId };
}

export type UnallocatedCharge = {
  id: string;
  lease_id: string;
  type: string;
  description: string | null;
  due_date: string;
  amount_minor: number;
  paid_minor: number;
  remaining_minor: number;
  currency: string;
  lease_no?: string;
};

export async function getTenantOutstandingCharges(
  tenantId: string,
): Promise<UnallocatedCharge[]> {
  const ctx = await getOrgContext();
  if (!ctx) return [];

  const { data, error } = await ctx.supabase
    .from("charges")
    .select("id, lease_id, type, description, due_date, amount_minor, paid_minor, currency, leases!inner(tenant_id, lease_no)")
    .eq("org_id", ctx.orgId)
    .eq("leases.tenant_id", tenantId)
    .in("status", ["pending", "partial", "overdue"])
    .order("due_date", { ascending: true });

  if (error || !data) return [];

  return data.map((c) => {
    const leaseData = c.leases as unknown as { tenant_id: string; lease_no: string } | null;
    return {
      id: c.id,
      lease_id: c.lease_id,
      type: c.type,
      description: c.description,
      due_date: c.due_date,
      amount_minor: c.amount_minor,
      paid_minor: c.paid_minor,
      remaining_minor: c.amount_minor - c.paid_minor,
      currency: c.currency,
      lease_no: leaseData?.lease_no,
    };
  });
}
