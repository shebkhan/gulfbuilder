"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toMinor } from "@/lib/money";
import { getOrgContext } from "@/server/org-context";

export type ChequeState = {
  error?: string;
  ok?: string;
  chequeId?: string;
  paymentId?: string;
};

const registerChequeSchema = z.object({
  tenantId: z.string().uuid(),
  leaseId: z.string().uuid(),
  chequeNo: z.string().trim().min(1).max(50),
  bankName: z.string().trim().min(1).max(100),
  amount: z.string().min(1),
  currency: z.string().length(3).default("QAR"),
  chequeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

const replaceChequeSchema = z.object({
  oldChequeId: z.string().uuid(),
  chequeNo: z.string().trim().min(1).max(50),
  bankName: z.string().trim().min(1).max(100),
  amount: z.string().min(1),
  currency: z.string().length(3).default("QAR"),
  chequeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

function fail(error: string): ChequeState {
  return { error };
}

export async function registerChequeAction(
  _prev: ChequeState,
  formData: FormData,
): Promise<ChequeState> {
  const ctx = await getOrgContext();
  if (!ctx || !["org_admin", "manager", "accountant"].includes(ctx.role)) {
    return fail("not_authorised");
  }

  const parsed = registerChequeSchema.safeParse({
    tenantId: formData.get("tenantId"),
    leaseId: formData.get("leaseId"),
    chequeNo: formData.get("chequeNo"),
    bankName: formData.get("bankName"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || "QAR",
    chequeDate: formData.get("chequeDate"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) return fail("invalid_input");

  const { tenantId, leaseId, chequeNo, bankName, amount, currency, chequeDate, notes } = parsed.data;

  let amountMinor: bigint;
  try {
    amountMinor = toMinor(amount, currency);
    if (amountMinor <= 0n) return fail("amount_must_be_positive");
  } catch {
    return fail("invalid_amount");
  }

  const { data: chequeId, error } = await ctx.supabase.rpc("register_cheque", {
    p_tenant_id: tenantId,
    p_lease_id: leaseId,
    p_cheque_no: chequeNo,
    p_bank_name: bankName,
    p_amount: Number(amountMinor),
    p_cheque_date: chequeDate,
    p_currency: currency,
    p_notes: notes || undefined,
  });

  if (error || !chequeId) {
    return fail(error?.message || "cheque_registration_failed");
  }

  revalidatePath("/cheques");
  revalidatePath(`/leases/${leaseId}`);
  return { ok: "cheque_registered", chequeId };
}

export async function depositChequeAction(
  _prev: ChequeState,
  formData: FormData,
): Promise<ChequeState> {
  const ctx = await getOrgContext();
  if (!ctx || !["org_admin", "manager", "accountant"].includes(ctx.role)) {
    return fail("not_authorised");
  }

  const chequeId = formData.get("chequeId") as string | null;
  const bankAccountId = (formData.get("bankAccountId") as string | null) || undefined;
  if (!chequeId) return fail("invalid_input");

  const { error } = await ctx.supabase.rpc("deposit_cheque", {
    p_cheque_id: chequeId,
    p_bank_account_id: bankAccountId,
  });

  if (error) return fail(error.message || "deposit_failed");

  revalidatePath("/cheques");
  return { ok: "cheque_deposited", chequeId };
}

export async function clearChequeAction(
  _prev: ChequeState,
  formData: FormData,
): Promise<ChequeState> {
  const ctx = await getOrgContext();
  if (!ctx || !["org_admin", "manager", "accountant"].includes(ctx.role)) {
    return fail("not_authorised");
  }

  const chequeId = formData.get("chequeId") as string | null;
  if (!chequeId) return fail("invalid_input");

  const { data: paymentId, error } = await ctx.supabase.rpc("clear_cheque", {
    p_cheque_id: chequeId,
  });

  if (error) return fail(error.message || "clear_failed");

  revalidatePath("/cheques");
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  return { ok: "cheque_cleared", chequeId, paymentId: paymentId || undefined };
}

export async function bounceChequeAction(
  _prev: ChequeState,
  formData: FormData,
): Promise<ChequeState> {
  const ctx = await getOrgContext();
  if (!ctx || !["org_admin", "manager", "accountant"].includes(ctx.role)) {
    return fail("not_authorised");
  }

  const chequeId = formData.get("chequeId") as string | null;
  const reason = (formData.get("reason") as string | null) || undefined;
  if (!chequeId) return fail("invalid_input");

  const { error } = await ctx.supabase.rpc("bounce_cheque", {
    p_cheque_id: chequeId,
    p_reason: reason,
  });

  if (error) return fail(error.message || "bounce_failed");

  revalidatePath("/cheques");
  return { ok: "cheque_bounced", chequeId };
}

export async function replaceChequeAction(
  _prev: ChequeState,
  formData: FormData,
): Promise<ChequeState> {
  const ctx = await getOrgContext();
  if (!ctx || !["org_admin", "manager", "accountant"].includes(ctx.role)) {
    return fail("not_authorised");
  }

  const parsed = replaceChequeSchema.safeParse({
    oldChequeId: formData.get("oldChequeId"),
    chequeNo: formData.get("chequeNo"),
    bankName: formData.get("bankName"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || "QAR",
    chequeDate: formData.get("chequeDate"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) return fail("invalid_input");

  const { oldChequeId, chequeNo, bankName, amount, currency, chequeDate, notes } = parsed.data;

  let amountMinor: bigint;
  try {
    amountMinor = toMinor(amount, currency);
    if (amountMinor <= 0n) return fail("amount_must_be_positive");
  } catch {
    return fail("invalid_amount");
  }

  const { data: newChequeId, error } = await ctx.supabase.rpc("replace_cheque", {
    p_old_cheque_id: oldChequeId,
    p_cheque_no: chequeNo,
    p_bank_name: bankName,
    p_amount: Number(amountMinor),
    p_cheque_date: chequeDate,
    p_currency: currency,
    p_notes: notes || undefined,
  });

  if (error || !newChequeId) {
    return fail(error?.message || "replacement_failed");
  }

  revalidatePath("/cheques");
  return { ok: "cheque_replaced", chequeId: newChequeId };
}
