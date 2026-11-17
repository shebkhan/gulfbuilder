"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CURRENCY_EXPONENTS } from "@/lib/money";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PlatformState = {
  error?: string;
  ok?: string;
  orgId?: string;
};

const FEATURES = ["owner_portal", "tenant_portal", "analytics", "custom_domain"] as const;

const createOrgSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, "invalid_slug"),
  countryCode: z.string().trim().length(2).default("QA"),
  baseCurrency: z
    .string()
    .trim()
    .refine((code) => code in CURRENCY_EXPONENTS)
    .default("QAR"),
  locale: z.enum(["en", "ar"]).default("en"),
});

const planSchema = z.object({
  orgId: z.string().uuid(),
  planCode: z.string().trim().min(1).max(40),
  status: z.enum(["active", "trialing", "past_due", "cancelled"]),
  periodEnd: z.string().trim().date().optional().or(z.literal("")),
  maxUnits: z.coerce.number().int().min(0).max(1_000_000),
  features: z.array(z.enum(FEATURES)),
});

const usageSchema = z.object({
  orgId: z.string().uuid(),
  takenOn: z.string().trim().date(),
  units: z.coerce.number().int().min(0),
  users: z.coerce.number().int().min(0),
  storageMb: z.coerce.number().int().min(0),
});

const marketPackSchema = z.object({
  countryCode: z.string().trim().length(2),
  effectiveFrom: z.string().trim().date(),
  version: z.coerce.number().int().min(1),
  rules: z.string().trim().min(2),
});

const impersonateSchema = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
  locale: z.enum(["en", "ar"]),
});

function fail(error: string): PlatformState {
  return { error };
}

/** Authorisation uses the caller's session; only the work below uses the service role. */
async function platformAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) return null;
  return { admin: createSupabaseAdminClient(), userId: user.id };
}

async function audit(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  actorId: string,
  tableName: string,
  action: string,
  orgId: string | null,
  rowId: string | null,
  newData: unknown,
) {
  const { error } = await admin.from("audit_log").insert({
    table_name: tableName,
    action,
    actor_id: actorId,
    org_id: orgId,
    row_id: rowId,
    new_data: newData as never,
  });
  if (error) throw new Error(`audit insert failed: ${error.message}`);
}

export async function createOrganizationAction(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  const ctx = await platformAdmin();
  if (!ctx) return fail("not_authorised");

  const parsed = createOrgSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    countryCode: formData.get("countryCode") || "QA",
    baseCurrency: formData.get("baseCurrency") || "QAR",
    locale: formData.get("locale") || "en",
  });
  if (!parsed.success) return fail("invalid_input");

  const { data: org, error } = await ctx.admin
    .from("organizations")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      country_code: parsed.data.countryCode,
      base_currency: parsed.data.baseCurrency,
      default_locale: parsed.data.locale,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return fail(error.code === "23505" ? "slug_taken" : "failed");

  await ctx.admin
    .from("org_branding")
    .insert({ org_id: org.id, app_name: parsed.data.name, created_by: ctx.userId });
  await ctx.admin.rpc("seed_chart_of_accounts", { p_org: org.id });
  await audit(ctx.admin, ctx.userId, "organizations", "create", org.id, org.id, parsed.data);

  revalidatePath("/platform");
  return { ok: "created", orgId: org.id };
}

export async function setOrganizationPlanAction(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  const ctx = await platformAdmin();
  if (!ctx) return fail("not_authorised");

  const parsed = planSchema.safeParse({
    orgId: formData.get("orgId"),
    planCode: formData.get("planCode"),
    status: formData.get("status"),
    periodEnd: formData.get("periodEnd") || undefined,
    maxUnits: formData.get("maxUnits") ?? 0,
    features: formData.getAll("features"),
  });
  if (!parsed.success) return fail("invalid_input");

  const { data: plan } = await ctx.admin
    .from("plans")
    .select("features, limits")
    .eq("code", parsed.data.planCode)
    .maybeSingle();
  if (!plan) return fail("plan_not_found");

  const features = {
    ...(typeof plan.features === "object" && plan.features ? plan.features : {}),
    ...Object.fromEntries(
      FEATURES.map((feature) => [feature, parsed.data.features.includes(feature)]),
    ),
  };
  const limits = { ...(typeof plan.limits === "object" && plan.limits ? plan.limits : {}), max_units: parsed.data.maxUnits };

  const { error: planError } = await ctx.admin
    .from("plans")
    .update({ features, limits })
    .eq("code", parsed.data.planCode);
  if (planError) return fail("failed");

  const { error: subError } = await ctx.admin.from("subscriptions").upsert({
    org_id: parsed.data.orgId,
    plan_code: parsed.data.planCode,
    status: parsed.data.status,
    period_end: parsed.data.periodEnd || null,
  });
  if (subError) return fail("failed");

  await ctx.admin
    .from("organizations")
    .update({ plan: parsed.data.planCode })
    .eq("id", parsed.data.orgId);
  await audit(ctx.admin, ctx.userId, "subscriptions", "set_plan", parsed.data.orgId, parsed.data.orgId, {
    plan_code: parsed.data.planCode,
    status: parsed.data.status,
    features,
    limits,
  });

  revalidatePath(`/platform/organizations/${parsed.data.orgId}`);
  return { ok: "plan_saved" };
}

export async function recordUsageSnapshotAction(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  const ctx = await platformAdmin();
  if (!ctx) return fail("not_authorised");

  const parsed = usageSchema.safeParse({
    orgId: formData.get("orgId"),
    takenOn: formData.get("takenOn"),
    units: formData.get("units") ?? 0,
    users: formData.get("users") ?? 0,
    storageMb: formData.get("storageMb") ?? 0,
  });
  if (!parsed.success) return fail("invalid_input");

  const { error } = await ctx.admin.from("usage_snapshots").upsert({
    org_id: parsed.data.orgId,
    taken_on: parsed.data.takenOn,
    units: parsed.data.units,
    users: parsed.data.users,
    storage_mb: parsed.data.storageMb,
  });
  if (error) return fail("failed");

  await audit(ctx.admin, ctx.userId, "usage_snapshots", "record", parsed.data.orgId, null, parsed.data);
  revalidatePath(`/platform/organizations/${parsed.data.orgId}`);
  return { ok: "snapshot_saved" };
}

export async function updateMarketPackAction(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  const ctx = await platformAdmin();
  if (!ctx) return fail("not_authorised");

  let rules: unknown;
  try {
    rules = JSON.parse(String(formData.get("rules") ?? ""));
  } catch {
    return fail("invalid_rules");
  }
  const parsed = marketPackSchema.safeParse({
    countryCode: formData.get("countryCode"),
    effectiveFrom: formData.get("effectiveFrom"),
    version: formData.get("version"),
    rules: JSON.stringify(rules),
  });
  if (!parsed.success) return fail("invalid_input");

  const { error } = await ctx.admin.from("market_packs").upsert({
    country_code: parsed.data.countryCode,
    effective_from: parsed.data.effectiveFrom,
    version: parsed.data.version,
    rules: rules as never,
  });
  if (error) return fail("failed");

  await audit(ctx.admin, ctx.userId, "market_packs", "update", null, null, {
    ...parsed.data,
    rules,
  });
  revalidatePath("/platform/market-packs");
  return { ok: "pack_saved" };
}

export async function impersonateAction(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  const ctx = await platformAdmin();
  if (!ctx) return fail("not_authorised");

  const parsed = impersonateSchema.safeParse({
    orgId: formData.get("orgId"),
    userId: formData.get("userId"),
    locale: formData.get("locale") || "en",
  });
  if (!parsed.success) return fail("invalid_input");

  await audit(ctx.admin, ctx.userId, "profiles", "impersonate", parsed.data.orgId, parsed.data.userId, {
    org_id: parsed.data.orgId,
    user_id: parsed.data.userId,
  });
  const { error } = await ctx.admin
    .from("profiles")
    .update({ active_org_id: parsed.data.orgId })
    .eq("id", parsed.data.userId);
  if (error) return fail("failed");

  revalidatePath(`/platform/organizations/${parsed.data.orgId}`);
  return { ok: "impersonated" };
}
