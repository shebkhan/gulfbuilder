"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@/lib/rbac";
import { generateKey } from "@/lib/api-keys";
import { getOrgContext } from "@/server/org-context";

export type ApiKeyState = { error?: string; ok?: string; key?: string };

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.enum(["owner", "org_admin", "manager", "accountant"]).default("owner"),
  ownerId: z.string().uuid().optional().or(z.literal("")),
});

export async function createApiKeyAction(
  _prev: ApiKeyState,
  formData: FormData,
): Promise<ApiKeyState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "settings.write")) return { error: "not_authorised" };

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    role: formData.get("role") || "owner",
    ownerId: formData.get("ownerId") || undefined,
  });
  if (!parsed.success) return { error: "invalid_input" };

  const { key, hash } = generateKey();
  const { error } = await ctx.supabase.from("api_keys").insert({
    org_id: ctx.orgId,
    user_id: ctx.userId,
    role: parsed.data.role,
    owner_id: parsed.data.ownerId || null,
    name: parsed.data.name,
    key_hash: hash,
    scopes: ["read"],
    created_by: ctx.userId,
  });
  if (error) return { error: "create_failed" };

  revalidatePath("/settings/integrations");
  return { ok: "created", key };
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "settings.write")) return;
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  const { error } = await ctx.supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", ctx.orgId);
  if (error) return;
  revalidatePath("/settings/integrations");
}
