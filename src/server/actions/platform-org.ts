"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { organizationUpdate } from "@/lib/org-settings";
import { integrationSchema, lookupSchema } from "@/schemas/platform-admin";
import { organizationSchema } from "@/schemas/settings";
import { audit, platformAdmin, type PlatformState } from "./platform";

const orgIdSchema = z.object({ orgId: z.string().uuid() });
const lookupIdSchema = orgIdSchema.extend({ id: z.string().uuid() });

function fail(error: string): PlatformState {
  return { error };
}

function revalidateOrg(orgId: string) {
  revalidatePath(`/platform/organizations/${orgId}`);
}

function settingsInput(formData: FormData) {
  return {
    name: formData.get("name"),
    legalName: formData.get("legalName") || undefined,
    taxId: formData.get("taxId") || undefined,
    baseCurrency: formData.get("baseCurrency") || "QAR",
    defaultLocale: formData.get("defaultLocale") || "en",
    timezone: formData.get("timezone") || "Asia/Qatar",
    graceDays: formData.get("graceDays") ?? 0,
    lateFee: formData.get("lateFee") ?? "0",
    lateFeeType: formData.get("lateFeeType") || "flat",
    lateFeePercent: formData.get("lateFeePercent") ?? 0,
    taxRate: formData.get("taxRate") ?? 0,
    reminderDays: formData.get("reminderDays") ?? 0,
    revenueRecognition: formData.get("revenueRecognition") || "on_due",
  };
}

export async function saveOrgSettingsAction(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  const ctx = await platformAdmin();
  if (!ctx) return fail("not_authorised");

  const ids = orgIdSchema.safeParse({ orgId: formData.get("orgId") });
  const parsed = organizationSchema.safeParse(settingsInput(formData));
  if (!ids.success || !parsed.success) return fail("invalid_input");

  const { data: org } = await ctx.admin
    .from("organizations")
    .select("settings")
    .eq("id", ids.data.orgId)
    .maybeSingle();
  if (!org) return fail("org_not_found");

  let update: ReturnType<typeof organizationUpdate>;
  try {
    update = organizationUpdate(parsed.data, org.settings ?? {});
  } catch {
    return fail("invalid_amount");
  }

  const { error } = await ctx.admin
    .from("organizations")
    .update(update)
    .eq("id", ids.data.orgId);
  if (error) return fail("failed");

  await audit(ctx.admin, ctx.userId, "organizations", "platform_settings", ids.data.orgId, null, {
    name: update.name,
    base_currency: update.base_currency,
  });
  revalidateOrg(ids.data.orgId);
  return { ok: "settings_saved" };
}

export async function upsertLookupAction(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  const ctx = await platformAdmin();
  if (!ctx) return fail("not_authorised");

  const id = formData.get("id");
  const parsed = lookupSchema.safeParse({
    orgId: formData.get("orgId"),
    category: formData.get("category"),
    code: formData.get("code"),
    label: formData.get("label"),
    sortOrder: formData.get("sortOrder") ?? 0,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return fail("invalid_input");

  const row = {
    org_id: parsed.data.orgId,
    category: parsed.data.category,
    code: parsed.data.code,
    label: parsed.data.label,
    sort_order: parsed.data.sortOrder,
    is_active: parsed.data.isActive,
    created_by: ctx.userId,
  };
  const { error } = id
    ? await ctx.admin
        .from("org_lookups")
        .update(row)
        .eq("id", String(id))
        .eq("org_id", parsed.data.orgId)
    : await ctx.admin.from("org_lookups").insert(row);
  if (error) return fail(error.code === "23505" ? "lookup_exists" : "failed");

  await audit(ctx.admin, ctx.userId, "org_lookups", id ? "update" : "create", parsed.data.orgId, id ? String(id) : null, row);
  revalidateOrg(parsed.data.orgId);
  return { ok: "lookup_saved" };
}

export async function deleteLookupAction(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  const ctx = await platformAdmin();
  if (!ctx) return fail("not_authorised");

  const parsed = lookupIdSchema.safeParse({
    orgId: formData.get("orgId"),
    id: formData.get("id"),
  });
  if (!parsed.success) return fail("invalid_input");

  const { error } = await ctx.admin
    .from("org_lookups")
    .delete()
    .eq("id", parsed.data.id)
    .eq("org_id", parsed.data.orgId);
  if (error) return fail("failed");

  await audit(ctx.admin, ctx.userId, "org_lookups", "delete", parsed.data.orgId, parsed.data.id, null);
  revalidateOrg(parsed.data.orgId);
  return { ok: "lookup_deleted" };
}

export async function saveOrgIntegrationAction(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  const ctx = await platformAdmin();
  if (!ctx) return fail("not_authorised");

  const ids = orgIdSchema.safeParse({ orgId: formData.get("orgId") });
  const parsed = integrationSchema.safeParse({
    provider: formData.get("provider") || "telegram",
    botToken: formData.get("botToken") || "",
    botName: formData.get("botName") || "",
    chatId: formData.get("chatId") || "",
    enabled: formData.get("enabled") === "on",
  });
  if (!ids.success || !parsed.success) return fail("invalid_input");

  const { data: existing } = await ctx.admin
    .from("org_integrations")
    .select("config")
    .eq("org_id", ids.data.orgId)
    .eq("provider", parsed.data.provider)
    .maybeSingle();
  const previous =
    typeof existing?.config === "object" && existing.config
      ? (existing.config as Record<string, unknown>)
      : {};
  const config = {
    bot_token: parsed.data.botToken || previous.bot_token || "",
    bot_name: parsed.data.botName,
    chat_id: parsed.data.chatId,
    enabled: parsed.data.enabled,
  };

  const { error } = await ctx.admin.from("org_integrations").upsert(
    {
      org_id: ids.data.orgId,
      provider: parsed.data.provider,
      config,
      created_by: ctx.userId,
    },
    { onConflict: "org_id,provider" },
  );
  if (error) return fail("failed");

  await audit(ctx.admin, ctx.userId, "org_integrations", "upsert", ids.data.orgId, null, {
    provider: parsed.data.provider,
    bot_name: config.bot_name,
    chat_id: config.chat_id,
    enabled: config.enabled,
    token_changed: Boolean(parsed.data.botToken),
  });
  revalidateOrg(ids.data.orgId);
  return { ok: "integration_saved" };
}
