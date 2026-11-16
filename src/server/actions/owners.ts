"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toMinor } from "@/lib/money";
import { can } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/server/org-context";

export type OwnerState = {
  error?: string;
  ok?: string;
  statementId?: string;
  payoutId?: string;
};

const generateStatementSchema = z.object({
  ownerId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.string().length(3).default("QAR"),
});

const recordPayoutSchema = z.object({
  ownerId: z.string().uuid(),
  amount: z.string().min(1),
  currency: z.string().length(3).default("QAR"),
  statementId: z.string().uuid().optional().or(z.literal("")),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.string().default("bank_transfer"),
  reference: z.string().trim().max(100).optional().or(z.literal("")),
  bankAccountId: z.string().uuid().optional().or(z.literal("")),
});

function fail(error: string): OwnerState {
  return { error };
}

export async function generateOwnerStatementAction(
  _prev: OwnerState,
  formData: FormData,
): Promise<OwnerState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "statements.write")) {
    return fail("not_authorised");
  }

  const parsed = generateStatementSchema.safeParse({
    ownerId: formData.get("ownerId"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    currency: formData.get("currency") || "QAR",
  });

  if (!parsed.success) return fail("invalid_input");

  const { ownerId, periodStart, periodEnd, currency } = parsed.data;

  const { data: statementId, error } = await ctx.supabase.rpc("generate_owner_statement", {
    p_owner_id: ownerId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_currency: currency,
  });

  if (error || !statementId) {
    return fail(error?.message || "statement_generation_failed");
  }

  revalidatePath("/reports");
  return { ok: "statement_generated", statementId };
}

export async function recordOwnerPayoutAction(
  _prev: OwnerState,
  formData: FormData,
): Promise<OwnerState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "statements.write")) {
    return fail("not_authorised");
  }

  const parsed = recordPayoutSchema.safeParse({
    ownerId: formData.get("ownerId"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || "QAR",
    statementId: formData.get("statementId") || undefined,
    paidOn: formData.get("paidOn") || new Date().toISOString().slice(0, 10),
    method: formData.get("method") || "bank_transfer",
    reference: formData.get("reference") || undefined,
    bankAccountId: formData.get("bankAccountId") || undefined,
  });

  if (!parsed.success) return fail("invalid_input");

  const { ownerId, amount, currency, statementId, paidOn, method, reference, bankAccountId } =
    parsed.data;

  let amountMinor: bigint;
  try {
    amountMinor = toMinor(amount, currency);
    if (amountMinor <= 0n) return fail("amount_must_be_positive");
  } catch {
    return fail("invalid_amount");
  }

  const { data: payoutId, error } = await ctx.supabase.rpc("record_owner_payout", {
    p_owner_id: ownerId,
    p_amount: Number(amountMinor),
    p_currency: currency,
    p_statement_id: statementId || undefined,
    p_paid_on: paidOn,
    p_method: method,
    p_reference: reference || undefined,
    p_bank_account_id: bankAccountId || undefined,
  });

  if (error || !payoutId) {
    return fail(error?.message || "payout_recording_failed");
  }

  revalidatePath("/reports");
  return { ok: "payout_recorded", payoutId };
}

/**
 * Give an owner a portal login (SPEC §8 O1). The service-role client creates the
 * login; the owner record and membership are written through the caller's session so
 * RLS still applies.
 */
export async function grantOwnerPortalAccessAction(
  _prev: OwnerState,
  formData: FormData,
): Promise<OwnerState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "settings.write")) return fail("not_authorised");

  const ownerId = formData.get("ownerId");
  if (typeof ownerId !== "string" || ownerId.length === 0) return fail("invalid_input");

  const { data: owner } = await ctx.supabase
    .from("owners")
    .select("id, name, contact, user_id")
    .eq("id", ownerId)
    .maybeSingle();

  if (!owner) return fail("not_found");
  if (owner.user_id) return { ok: "already_linked" };

  const contact = (owner.contact ?? {}) as Record<string, string | undefined>;
  const email = String(formData.get("email") ?? contact.email ?? "").trim();
  if (!email) return fail("email_required");

  const admin = createSupabaseAdminClient();
  let userId: string | undefined;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: `${crypto.randomUUID()}Aa1!`,
  });

  if (created?.user) {
    userId = created.user.id;
  } else if (createError?.message.toLowerCase().includes("already")) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  }
  if (!userId) return fail("portal_failed");

  await admin.from("profiles").upsert({
    id: userId,
    full_name: owner.name,
    active_org_id: ctx.orgId,
  });
  await admin.from("org_members").upsert({
    org_id: ctx.orgId,
    user_id: userId,
    role: "owner",
  });

  const { error } = await ctx.supabase
    .from("owners")
    .update({ user_id: userId })
    .eq("id", ownerId)
    .eq("org_id", ctx.orgId);
  if (error) return fail("failed");

  revalidatePath("/reports");
  return { ok: "portal_enabled" };
}
