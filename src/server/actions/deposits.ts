"use server";

import { revalidatePath } from "next/cache";
import { toMinor } from "@/lib/money";
import { deductionSchema, refundSchema } from "@/schemas/deposits";
import { getOrgContext } from "@/server/org-context";

export type DepositState = {
  error?: string;
  ok?: string;
  depositId?: string;
};

function fail(error: string): DepositState {
  return { error };
}

export async function applyDeductionAction(
  _prev: DepositState,
  formData: FormData,
): Promise<DepositState> {
  const ctx = await getOrgContext();
  if (!ctx || !["org_admin", "manager"].includes(ctx.role)) {
    return fail("not_authorised");
  }

  const parsed = deductionSchema.safeParse({
    depositId: formData.get("depositId"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || "QAR",
    reason: formData.get("reason"),
    chargeId: formData.get("chargeId") || undefined,
  });

  if (!parsed.success) return fail("invalid_input");

  const { depositId, amount, currency, reason, chargeId } = parsed.data;

  let amountMinor: bigint;
  try {
    amountMinor = toMinor(amount, currency);
    if (amountMinor <= 0n) return fail("amount_must_be_positive");
  } catch {
    return fail("invalid_amount");
  }

  const { error } = await ctx.supabase.rpc("apply_deposit_deduction", {
    p_deposit_id: depositId,
    p_amount: Number(amountMinor),
    p_reason: reason,
    p_charge_id: chargeId || undefined,
  });

  if (error) return fail(error.message || "deduction_failed");

  revalidatePath("/deposits");
  revalidatePath("/leases");
  return { ok: "deduction_applied", depositId };
}

export async function refundDepositAction(
  _prev: DepositState,
  formData: FormData,
): Promise<DepositState> {
  const ctx = await getOrgContext();
  if (!ctx || !["org_admin", "manager"].includes(ctx.role)) {
    return fail("not_authorised");
  }

  const parsed = refundSchema.safeParse({
    depositId: formData.get("depositId"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || "QAR",
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) return fail("invalid_input");

  const { depositId, amount, currency, reason } = parsed.data;

  let amountMinor: bigint;
  try {
    amountMinor = toMinor(amount, currency);
    if (amountMinor <= 0n) return fail("amount_must_be_positive");
  } catch {
    return fail("invalid_amount");
  }

  const { error } = await ctx.supabase.rpc("refund_deposit", {
    p_deposit_id: depositId,
    p_amount: Number(amountMinor),
    p_reason: reason || undefined,
  });

  if (error) return fail(error.message || "refund_failed");

  revalidatePath("/deposits");
  revalidatePath("/leases");
  return { ok: "refund_recorded", depositId };
}
