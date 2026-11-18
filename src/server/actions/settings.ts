"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomInt } from "node:crypto";
import { organizationUpdate } from "@/lib/org-settings";
import { can } from "@/lib/rbac";
import { brandingSchema, organizationSchema, templateSchema } from "@/schemas/settings";
import { dispatchPending } from "@/server/notifications/dispatch";
import { getOrgContext } from "@/server/org-context";
import type { Database } from "@/types/database";

export type SettingsState = {
  error?: string;
  ok?: string;
};

export type UploadBrandAssetState = {
  error?: string;
  ok?: string;
  url?: string;
};

const BRANDING_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const BRANDING_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const brandAssetKindSchema = z.enum(["logo", "favicon"]);

const pushSubscriptionSchema = z.object({
  endpoint: z.string(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

function fail(error: string): SettingsState {
  return { error };
}

export async function updateOrganizationSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "settings.write")) return fail("not_authorised");

  const parsed = organizationSchema.safeParse({
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
  });
  if (!parsed.success) return fail("invalid_input");

  const { data: org } = await ctx.supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.orgId)
    .maybeSingle();
  let update: ReturnType<typeof organizationUpdate>;
  try {
    update = organizationUpdate(parsed.data, org?.settings ?? {});
  } catch {
    return fail("invalid_amount");
  }

  const { error } = await ctx.supabase
    .from("organizations")
    .update(update)
    .eq("id", ctx.orgId);
  if (error) return fail("failed");

  revalidatePath("/settings/organization");
  revalidatePath("/dashboard");
  return { ok: "saved" };
}

export async function updateBrandingAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "settings.write")) return fail("not_authorised");

  const parsed = brandingSchema.safeParse({
    appName: formData.get("appName") || undefined,
    logoUrl: formData.get("logoUrl") || undefined,
    faviconUrl: formData.get("faviconUrl") || undefined,
    primaryColor: formData.get("primaryColor") || undefined,
    secondaryColor: formData.get("secondaryColor") || undefined,
    fontFamily: formData.get("fontFamily") || undefined,
    terminology: formData.get("terminology") || undefined,
    customDomain: formData.get("customDomain") || undefined,
  });
  if (!parsed.success) return fail("invalid_input");

  const data = parsed.data;

  let terminology: Record<string, string> = {};
  if (data.terminology) {
    try {
      const parsedTerminology = JSON.parse(data.terminology);
      if (
        typeof parsedTerminology === "object" &&
        parsedTerminology !== null &&
        !Array.isArray(parsedTerminology)
      ) {
        terminology = Object.fromEntries(
          Object.entries(parsedTerminology).map(([k, v]) => [k, String(v)]),
        );
      } else {
        return fail("invalid_terminology");
      }
    } catch {
      return fail("invalid_terminology");
    }
  }

  const { data: current } = await ctx.supabase
    .from("org_branding")
    .select("custom_domain")
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  const domainChanged =
    data.customDomain !== undefined && data.customDomain !== (current?.custom_domain ?? "");

  const update: Database["public"]["Tables"]["org_branding"]["Update"] = {
    app_name: data.appName || null,
    logo_url: data.logoUrl || null,
    favicon_url: data.faviconUrl || null,
    primary_color: data.primaryColor || null,
    secondary_color: data.secondaryColor || null,
    font_family: data.fontFamily || null,
    terminology,
    updated_at: new Date().toISOString(),
  };

  if (domainChanged) {
    update.custom_domain = data.customDomain || null;
    update.custom_domain_status = data.customDomain ? "pending" : "none";
    update.custom_domain_verified_at = null;
  }

  const { error } = await ctx.supabase
    .from("org_branding")
    .update(update)
    .eq("org_id", ctx.orgId);
  if (error) {
    if (error.code === "23505") return fail("domain_taken");
    return fail("failed");
  }

  revalidatePath("/settings/branding");
  return { ok: "saved" };
}

export async function uploadBrandAssetAction(
  _prev: UploadBrandAssetState,
  formData: FormData,
): Promise<UploadBrandAssetState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "settings.write")) return { error: "not_authorised" };

  const parsedKind = brandAssetKindSchema.safeParse(formData.get("kind"));
  if (!parsedKind.success) return { error: "invalid_input" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "file_required" };
  if (file.size > BRANDING_MAX_UPLOAD_BYTES) return { error: "file_too_large" };
  if (!BRANDING_ALLOWED_TYPES.includes(file.type)) return { error: "unsupported_file_type" };

  const kind = parsedKind.data;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${ctx.orgId}/${kind}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await ctx.supabase.storage
    .from("branding")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { error: "upload_failed" };

  const url = ctx.supabase.storage.from("branding").getPublicUrl(path).data.publicUrl;
  const update: Database["public"]["Tables"]["org_branding"]["Update"] = {
    updated_at: new Date().toISOString(),
  };
  if (kind === "logo") update.logo_url = url;
  else update.favicon_url = url;

  const { error } = await ctx.supabase
    .from("org_branding")
    .update(update)
    .eq("org_id", ctx.orgId);
  if (error) {
    await ctx.supabase.storage.from("branding").remove([path]);
    return { error: "failed" };
  }

  revalidatePath("/settings/branding");
  return { ok: "uploaded", url };
}

export async function updateNotificationTemplateAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "settings.write")) return fail("not_authorised");

  const parsed = templateSchema.safeParse({
    event: formData.get("event"),
    channel: formData.get("channel"),
    locale: formData.get("locale"),
    subject: formData.get("subject") || undefined,
    body: formData.get("body"),
  });
  if (!parsed.success) return fail("invalid_input");

  const { error } = await ctx.supabase.from("notification_templates").upsert(
    {
      org_id: ctx.orgId,
      event: parsed.data.event,
      channel: parsed.data.channel,
      locale: parsed.data.locale,
      subject: parsed.data.subject || null,
      body: parsed.data.body,
    },
    { onConflict: "org_id,event,channel,locale" },
  );
  if (error) return fail("failed");

  revalidatePath("/settings/notifications");
  return { ok: "saved" };
}

export async function generateTelegramLinkCodeAction(
  _prev: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "settings.write")) return fail("not_authorised");

  // Retry until we draw a code no unexpired profile is already using, so two
  // people cannot link with the same code inside the 10-minute window.
  const now = new Date();
  const expires = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  let code: string | null = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const { data: clash } = await ctx.supabase
      .from("profiles")
      .select("id")
      .eq("telegram_link_code", candidate)
      .gt("telegram_link_expires_at", now.toISOString())
      .limit(1);
    if (!clash?.length) {
      code = candidate;
      break;
    }
  }
  if (!code) return fail("failed");

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ telegram_link_code: code, telegram_link_expires_at: expires })
    .eq("id", ctx.userId);
  if (error) return fail("failed");

  revalidatePath("/settings/notifications");
  return { ok: "code_generated" };
}

export async function unlinkTelegramAction(
  _prev: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "settings.write")) return fail("not_authorised");

  const { error } = await ctx.supabase
    .from("profiles")
    .update({
      telegram_chat_id: null,
      telegram_link_code: null,
      telegram_link_expires_at: null,
    })
    .eq("id", ctx.userId);
  if (error) return fail("failed");

  revalidatePath("/settings/notifications");
  return { ok: "unlinked" };
}

export async function savePushSubscriptionAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "settings.write")) return fail("not_authorised");

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("subscription") ?? ""));
  } catch {
    return fail("invalid_input");
  }
  const parsed = pushSubscriptionSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input");

  const { error } = await ctx.supabase.from("web_push_subscriptions").upsert(
    {
      org_id: ctx.orgId,
      user_id: ctx.userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      created_by: ctx.userId,
    },
    { onConflict: "endpoint" },
  );
  if (error) return fail("failed");

  revalidatePath("/settings/notifications");
  return { ok: "saved" };
}

export async function removePushSubscriptionAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "settings.write")) return fail("not_authorised");

  const endpoint = String(formData.get("endpoint") ?? "");
  if (!endpoint) return fail("invalid_input");

  const { error } = await ctx.supabase
    .from("web_push_subscriptions")
    .delete()
    .eq("user_id", ctx.userId)
    .eq("endpoint", endpoint);
  if (error) return fail("failed");

  revalidatePath("/settings/notifications");
  return { ok: "unsubscribed" };
}

export async function sendNotificationsNowAction(
  _prev: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "settings.write")) return fail("not_authorised");

  await dispatchPending();

  revalidatePath("/settings/notifications");
  return { ok: "dispatched" };
}

export async function closePeriodAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "ledger.close")) return fail("not_authorised");

  const month = String(formData.get("month") ?? "");
  if (!/^\d{4}-\d{2}-01$/.test(month)) return fail("invalid_input");

  const { error } = await ctx.supabase.rpc("close_period", { p_month: month });
  if (error) return fail("close_failed");

  revalidatePath("/settings/accounting");
  return { ok: "period_closed" };
}

export async function reopenPeriodAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "ledger.close")) return fail("not_authorised");

  const month = String(formData.get("month") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!/^\d{4}-\d{2}-01$/.test(month) || reason.length === 0) return fail("invalid_input");

  const { error } = await ctx.supabase.rpc("reopen_period", {
    p_month: month,
    p_reason: reason,
  });
  if (error) return fail("reopen_failed");

  revalidatePath("/settings/accounting");
  return { ok: "period_reopened" };
}

export async function runOverdueSweepAction(
  _prev: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "ledger.write")) return fail("not_authorised");

  const { data, error } = await ctx.supabase.rpc("mark_overdue_and_late_fees");
  if (error) return fail("sweep_failed");

  revalidatePath("/settings/accounting");
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  return { ok: `sweep_done:${data ?? 0}` };
}
