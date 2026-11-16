"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

export type TenantState = {
  error?: string;
  ok?: string;
  plaintextId?: string;
};

const tenantSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  kind: z.enum(["person", "company"]).default("person"),
  language: z.enum(["ar", "en"]).default("ar"),
  idNumber: z
    .string()
    .trim()
    .min(4)
    .max(30)
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal("")),
  nationality: z.string().trim().max(60).optional().or(z.literal("")),
  employer: z.string().trim().max(120).optional().or(z.literal("")),
});

function fail(error: string): TenantState {
  return { error };
}

export async function createTenantAction(
  _prev: TenantState,
  formData: FormData,
): Promise<TenantState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "tenants.write")) return fail("not_authorised");

  const parsed = tenantSchema.safeParse({
    fullName: formData.get("fullName"),
    kind: formData.get("kind") || "person",
    language: formData.get("language") || "ar",
    idNumber: formData.get("idNumber") || undefined,
    phone: formData.get("phone") || undefined,
    whatsapp: formData.get("whatsapp") || undefined,
    email: formData.get("email") || undefined,
    nationality: formData.get("nationality") || undefined,
    employer: formData.get("employer") || undefined,
  });

  if (!parsed.success) return fail("invalid_input");

  let idNumberEnc: string | null = null;
  if (parsed.data.idNumber) {
    const { data: enc, error: encErr } = await ctx.supabase.rpc("encrypt_id", {
      p_plaintext: parsed.data.idNumber,
    });
    if (encErr || !enc) return fail("failed");
    idNumberEnc = enc;
  }

  const { error } = await ctx.supabase.from("tenants").insert({
    org_id: ctx.orgId,
    full_name: parsed.data.fullName,
    kind: parsed.data.kind,
    language: parsed.data.language,
    id_number_enc: idNumberEnc,
    phone: parsed.data.phone || null,
    whatsapp: parsed.data.whatsapp || null,
    email: parsed.data.email || null,
    nationality: parsed.data.nationality || null,
    employer: parsed.data.employer || null,
    created_by: ctx.userId,
  });

  if (error) return fail("failed");

  revalidatePath("/[locale]/tenants", "page");
  return { ok: "created" };
}

export async function updateTenantAction(
  tenantId: string,
  _prev: TenantState,
  formData: FormData,
): Promise<TenantState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "tenants.write")) return fail("not_authorised");

  const parsed = tenantSchema.safeParse({
    fullName: formData.get("fullName"),
    kind: formData.get("kind") || "person",
    language: formData.get("language") || "ar",
    idNumber: formData.get("idNumber") || undefined,
    phone: formData.get("phone") || undefined,
    whatsapp: formData.get("whatsapp") || undefined,
    email: formData.get("email") || undefined,
    nationality: formData.get("nationality") || undefined,
    employer: formData.get("employer") || undefined,
  });

  if (!parsed.success) return fail("invalid_input");

  const updateData: Record<string, unknown> = {
    full_name: parsed.data.fullName,
    kind: parsed.data.kind,
    language: parsed.data.language,
    phone: parsed.data.phone || null,
    whatsapp: parsed.data.whatsapp || null,
    email: parsed.data.email || null,
    nationality: parsed.data.nationality || null,
    employer: parsed.data.employer || null,
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.idNumber) {
    const { data: enc, error: encErr } = await ctx.supabase.rpc("encrypt_id", {
      p_plaintext: parsed.data.idNumber,
    });
    if (encErr || !enc) return fail("failed");
    updateData.id_number_enc = enc;
  }

  const { error } = await ctx.supabase
    .from("tenants")
    .update(updateData)
    .eq("id", tenantId)
    .eq("org_id", ctx.orgId);

  if (error) return fail("failed");

  revalidatePath(`/[locale]/tenants/${tenantId}`, "page");
  revalidatePath("/[locale]/tenants", "page");
  return { ok: "updated" };
}

export async function revealTenantIdAction(tenantId: string): Promise<TenantState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "tenants.write")) return fail("not_authorised");

  const { data, error } = await ctx.supabase.rpc("tenant_id_number", {
    p_tenant: tenantId,
  });

  if (error || !data) return fail("not_found");
  return { ok: "revealed", plaintextId: data };
}

