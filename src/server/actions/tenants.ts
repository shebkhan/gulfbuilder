"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/server/org-context";

export type TenantState = {
  error?: string;
  ok?: string;
  plaintextId?: string;
  portalEnabled?: boolean;
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

  // A tenant with an email gets a portal login (SPEC §8 T1). The login is created
  // with a random password: the tenant sets one through "forgot password".
  const portalUserId = parsed.data.email
    ? await ensurePortalUser(parsed.data.email, ctx.orgId, parsed.data.language, parsed.data.fullName)
    : null;

  const { data: created, error } = await ctx.supabase
    .from("tenants")
    .insert({
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
      user_id: portalUserId,
      created_by: ctx.userId,
    })
    .select("id")
    .maybeSingle();

  if (error || !created) return fail("failed");

  revalidatePath("/[locale]/tenants", "page");
  return { ok: "created", portalEnabled: Boolean(portalUserId) };
}

/**
 * Create (or find) the auth user behind a tenant portal login and give it the tenant
 * membership. The service-role client is used the same way the team invite uses it:
 * authorisation already passed on the caller's session.
 */
async function ensurePortalUser(
  email: string,
  orgId: string,
  locale: string,
  fullName: string,
): Promise<string | null> {
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

  if (!userId) return null;

  await admin.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    locale,
    active_org_id: orgId,
  });
  await admin.from("org_members").upsert({
    org_id: orgId,
    user_id: userId,
    role: "tenant",
  });

  return userId;
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

  // Link a portal login the first time an email is known.
  if (parsed.data.email) {
    const { data: existing } = await ctx.supabase
      .from("tenants")
      .select("user_id")
      .eq("id", tenantId)
      .maybeSingle();
    if (existing && !existing.user_id) {
      const portalUserId = await ensurePortalUser(
        parsed.data.email,
        ctx.orgId,
        parsed.data.language,
        parsed.data.fullName,
      );
      if (portalUserId) updateData.user_id = portalUserId;
    }
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

/** Give an existing tenant a portal login (SPEC §8 T1). */
export async function grantTenantPortalAccessAction(tenantId: string): Promise<TenantState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "tenants.write")) return fail("not_authorised");

  const { data: tenant } = await ctx.supabase
    .from("tenants")
    .select("id, full_name, email, language, user_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) return fail("not_found");
  if (!tenant.email) return fail("email_required");
  if (tenant.user_id) return { ok: "already_linked" };

  const userId = await ensurePortalUser(
    tenant.email,
    ctx.orgId,
    tenant.language ?? "ar",
    tenant.full_name,
  );
  if (!userId) return fail("portal_failed");

  const { error } = await ctx.supabase
    .from("tenants")
    .update({ user_id: userId })
    .eq("id", tenantId)
    .eq("org_id", ctx.orgId);
  if (error) return fail("failed");

  revalidatePath(`/[locale]/tenants/${tenantId}`, "page");
  return { ok: "portal_enabled" };
}

