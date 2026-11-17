"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomInt } from "node:crypto";
import { toMinor } from "@/lib/money";
import { can } from "@/lib/rbac";
import { dispatchPending } from "@/server/notifications/dispatch";
import { getOrgContext } from "@/server/org-context";

export type SettingsState = {
  error?: string;
  ok?: string;
};

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  legalName: z.string().trim().max(120).optional().or(z.literal("")),
  taxId: z.string().trim().max(60).optional().or(z.literal("")),
  baseCurrency: z.enum(["QAR", "AED", "SAR", "KWD", "BHD", "OMR"]),
  defaultLocale: z.enum(["en", "ar"]),
  timezone: z.string().trim().min(1).max(60),
  graceDays: z.coerce.number().int().min(0).max(90),
  lateFee: z.string().min(1),
  lateFeeType: z.enum(["flat", "percent"]),
  lateFeePercent: z.coerce.number().min(0).max(100),
  taxRate: z.coerce.number().min(0).max(100),
  reminderDays: z.coerce.number().int().min(0).max(60),
  revenueRecognition: z.enum(["on_due", "straight_line_monthly"]),
});

const brandingSchema = z.object({
  appName: z.string().trim().max(80).optional().or(z.literal("")),
  logoUrl: z.string().trim().max(300).optional().or(z.literal("")),
  faviconUrl: z.string().trim().max(300).optional().or(z.literal("")),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "invalid_color")
    .optional()
    .or(z.literal("")),
  secondaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "invalid_color")
    .optional()
    .or(z.literal("")),
  fontFamily: z.string().trim().max(80).optional().or(z.literal("")),
  terminology: z.string().optional().or(z.literal("")),
  customDomain: z.string().trim().max(200).optional().or(z.literal("")),
});

const templateSchema = z.object({
  event: z.string().trim().min(2).max(60),
  channel: z.enum(["email", "sms", "telegram", "push"]),
  locale: z.enum(["en", "ar"]),
  subject: z.string().trim().max(160).optional().or(z.literal("")),
  body: z.string().trim().min(1).max(4000),
});

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

  const data = parsed.data;
  let lateFeeMinor: bigint;
  try {
    lateFeeMinor = toMinor(data.lateFee, data.baseCurrency);
  } catch {
    return fail("invalid_amount");
  }

  const { data: org } = await ctx.supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.orgId)
    .maybeSingle();
  const settings = {
    ...((org?.settings ?? {}) as Record<string, unknown>),
    grace_days: data.graceDays,
    late_fee_minor: Number(lateFeeMinor),
    late_fee_type: data.lateFeeType,
    late_fee_percent: data.lateFeePercent,
    tax_rate: data.taxRate,
    reminder_days: data.reminderDays,
    revenue_recognition: data.revenueRecognition,
  };

  const { error } = await ctx.supabase
    .from("organizations")
    .update({
      name: data.name,
      legal_name: data.legalName || null,
      tax_id: data.taxId || null,
      base_currency: data.baseCurrency,
      default_locale: data.defaultLocale,
      timezone: data.timezone,
      settings,
    })
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

  const update: Record<string, unknown> = {
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
