"use server";

import { revalidatePath } from "next/cache";
import { toMinor } from "@/lib/money";
import { registerChequeSchema, replaceChequeSchema } from "@/schemas/cheques";
import { getOrgContext } from "@/server/org-context";
import { parseChequeImage } from "@/server/cheque-ocr";
import type { ParsedCheque } from "@/schemas/cheques";

export type ChequeState = {
  error?: string;
  ok?: string;
  chequeId?: string;
  paymentId?: string;
  imagePath?: string;
};

export type ChequeParseState = {
  error?: string;
  ok?: string;
  imagePath?: string;
  parsed?: ParsedCheque | null;
  suggestedTenantId?: string | null;
};

function fail(error: string): ChequeState {
  return { error };
}

function failParse(error: string): ChequeParseState {
  return { error };
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

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
    imagePath: formData.get("imagePath") || undefined,
    payeeRaw: formData.get("payeeRaw") || undefined,
  });

  if (!parsed.success) return fail("invalid_input");

  const { tenantId, leaseId, chequeNo, bankName, amount, currency, chequeDate, notes, imagePath, payeeRaw } = parsed.data;

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
    p_image_path: imagePath || undefined,
    p_payee_raw: payeeRaw || undefined,
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

export async function parseChequeImageAction(
  _prev: ChequeParseState,
  formData: FormData,
): Promise<ChequeParseState> {
  const ctx = await getOrgContext();
  if (!ctx || !["org_admin", "manager", "accountant"].includes(ctx.role)) {
    return failParse("not_authorised");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return failParse("file_required");
  if (file.size > MAX_UPLOAD_BYTES) return failParse("file_too_large");
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return failParse("unsupported_file_type");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${ctx.orgId}/cheques/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await ctx.supabase.storage
    .from("cheques")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return failParse("upload_failed");

  let parsed: ParsedCheque | null = null;
  let parseError: string | undefined;
  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    parsed = await parseChequeImage(base64, file.type);
    if (!parsed) parseError = "parse_failed";
  } catch {
    parseError = "ocr_not_configured";
  }

  let suggestedTenantId: string | null = null;
  if (parsed?.payee) {
    const { data: tenants } = await ctx.supabase
      .from("tenants")
      .select("id, full_name")
      .eq("org_id", ctx.orgId);
    const needle = parsed.payee.toLowerCase();
    const match = (tenants ?? []).find((t) => {
      const name = (t.full_name ?? "").toLowerCase();
      return name.includes(needle) || needle.includes(name);
    });
    suggestedTenantId = match?.id ?? null;
  }

  return {
    ok: "parsed",
    imagePath: path,
    parsed,
    suggestedTenantId,
    error: parseError,
  };
}

export async function getChequeImageUrlAction(imagePath: string): Promise<ChequeState> {
  const ctx = await getOrgContext();
  if (!ctx) return fail("not_authorised");
  if (!imagePath || !imagePath.startsWith(`${ctx.orgId}/`)) return fail("not_found");

  const { data, error } = await ctx.supabase.storage
    .from("cheques")
    .createSignedUrl(imagePath, 60 * 10);
  if (error || !data) return fail("signing_failed");

  return { ok: "signed", imagePath: data.signedUrl };
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
    imagePath: formData.get("imagePath") || undefined,
    payeeRaw: formData.get("payeeRaw") || undefined,
  });

  if (!parsed.success) return fail("invalid_input");

  const { oldChequeId, chequeNo, bankName, amount, currency, chequeDate, notes, imagePath, payeeRaw } = parsed.data;

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
    p_image_path: imagePath || undefined,
    p_payee_raw: payeeRaw || undefined,
  });

  if (error || !newChequeId) {
    return fail(error?.message || "replacement_failed");
  }

  revalidatePath("/cheques");
  return { ok: "cheque_replaced", chequeId: newChequeId };
}
