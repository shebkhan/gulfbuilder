"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toMinor } from "@/lib/money";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

export type ExpenseState = {
  error?: string;
  ok?: string;
  expenseId?: string;
};

const createExpenseSchema = z.object({
  category: z.string().trim().min(1).max(50),
  description: z.string().trim().min(1).max(300),
  amount: z.string().min(1),
  currency: z.string().length(3).default("QAR"),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vendorId: z.string().uuid().optional().or(z.literal("")),
  buildingId: z.string().uuid().optional().or(z.literal("")),
  unitId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

function fail(error: string): ExpenseState {
  return { error };
}

export async function createExpenseAction(
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "expenses.write")) {
    return fail("not_authorised");
  }

  const parsed = createExpenseSchema.safeParse({
    category: formData.get("category"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || "QAR",
    expenseDate: formData.get("expenseDate"),
    vendorId: formData.get("vendorId") || undefined,
    buildingId: formData.get("buildingId") || undefined,
    unitId: formData.get("unitId") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) return fail("invalid_input");

  const {
    category,
    description,
    amount,
    currency,
    expenseDate,
    vendorId,
    buildingId,
    unitId,
    notes,
  } = parsed.data;

  let amountMinor: bigint;
  try {
    amountMinor = toMinor(amount, currency);
    if (amountMinor <= 0n) return fail("amount_must_be_positive");
  } catch {
    return fail("invalid_amount");
  }

  const { data: expenseId, error } = await ctx.supabase.rpc("record_expense", {
    p_category: category,
    p_description: description,
    p_amount: Number(amountMinor),
    p_date: expenseDate,
    p_vendor_id: vendorId || undefined,
    p_building_id: buildingId || undefined,
    p_unit_id: unitId || undefined,
    p_currency: currency,
    p_notes: notes || undefined,
  });

  if (error || !expenseId) {
    return fail(error?.message || "expense_creation_failed");
  }

  revalidatePath("/expenses");
  return { ok: "expense_created", expenseId };
}

export async function approveExpenseAction(
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "expenses.approve")) {
    return fail("not_authorised");
  }

  const expenseId = formData.get("expenseId") as string | null;
  if (!expenseId) return fail("invalid_input");

  const { error } = await ctx.supabase.rpc("approve_expense", {
    p_expense_id: expenseId,
  });

  if (error) return fail(error.message || "approval_failed");

  revalidatePath("/expenses");
  return { ok: "expense_approved", expenseId };
}

export async function payExpenseAction(
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  const ctx = await getOrgContext();
  if (!ctx || !["org_admin", "accountant"].includes(ctx.role)) {
    return fail("not_authorised");
  }

  const expenseId = formData.get("expenseId") as string | null;
  const bankAccountId = (formData.get("bankAccountId") as string | null) || undefined;
  if (!expenseId) return fail("invalid_input");

  const { error } = await ctx.supabase.rpc("pay_expense", {
    p_expense_id: expenseId,
    p_bank_account_id: bankAccountId,
  });

  if (error) return fail(error.message || "payment_failed");

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { ok: "expense_paid", expenseId };
}
