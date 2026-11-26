import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";

export const PASSWORD = "GulfE2E!2026";
export const OWNER_EMAIL = "e2e-owner@gulf.test";
export const MANAGER_EMAIL = "e2e-manager@gulf.test";
export const ORG_NAME = "Gulf E2E";
export const ORG_SLUG = "gulf-e2e";
export const BUILDING_CODE = "E2E-TWR";
export const BUILDING_NAME = "E2E Tower";

export type Fixture = {
  orgId: string;
  ownerId: string;
  managerId: string;
  buildingId: string;
  unitIds: string[];
  listingSlug: string;
};

export function env(): { url: string; anon: string; service: string } {
  const file = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const values: Record<string, string> = {};
  for (const line of file.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match?.[1] && match[2]) values[match[1]] = match[2].trim();
  }
  const url = values.NEXT_PUBLIC_SUPABASE_URL;
  const anon = values.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = values.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) throw new Error(".env.local is missing Supabase credentials");
  return { url, anon, service };
}

export function adminClient(): SupabaseClient {
  const { url, service } = env();
  return createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient(): SupabaseClient {
  const { url, anon } = env();
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** PostgREST upsert that fails loudly — a silently skipped fixture breaks every test. */
async function upsert(
  table: ReturnType<SupabaseClient["from"]>,
  row: Record<string, unknown>,
  onConflict: string,
): Promise<void> {
  const builder = (table as unknown as {
    upsert: (values: Record<string, unknown>, options: { onConflict: string }) => {
      select: () => Promise<{ error: { message: string } | null }>;
    };
  }).upsert(row, { onConflict });
  const { error } = await builder.select();
  if (error) throw new Error(`fixture upsert failed: ${error.message}`);
}

export function userIdFromToken(token: string): string {
  const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString());
  return payload.sub as string;
}

async function ensureUser(email: string): Promise<{ id: string; token: string }> {
  const anon = anonClient();
  const grant = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (!grant.error && grant.data.session) {
    return { id: grant.data.user.id, token: grant.data.session.access_token };
  }

  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`could not create ${email}: ${error?.message}`);

  const retry = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (retry.error || !retry.data.session) throw new Error(`could not sign in ${email}`);
  return { id: data.user.id, token: retry.data.session.access_token };
}

/**
 * Creates the E2E organization, its two users and one building with four units.
 * Idempotent: an existing fixture is reused, so repeated runs do not pile up data.
 */
export async function ensureFixture(): Promise<Fixture> {
  const admin = adminClient();
  const owner = await ensureUser(OWNER_EMAIL);
  const manager = await ensureUser(MANAGER_EMAIL);

  const existing = await admin.from("organizations").select("id").eq("slug", ORG_SLUG).maybeSingle();
  let orgId = existing.data?.id as string | undefined;

  if (!orgId) {
    const client = createClient(env().url, env().anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${owner.token}` } },
    });
    const { data, error } = await client.rpc("create_organization", {
      p_name: ORG_NAME,
      p_slug: ORG_SLUG,
      p_country_code: "QA",
      p_base_currency: "QAR",
      p_locale: "en",
    });
    if (error) throw new Error(`could not create the E2E organization: ${error.message}`);
    orgId = data as string;
  }

  await upsert(admin.from("profiles"), { id: owner.id, active_org_id: orgId, locale: "en" }, "id");
  await upsert(
    admin.from("profiles"),
    { id: manager.id, active_org_id: orgId, locale: "en", full_name: "E2E Manager" },
    "id",
  );
  await upsert(
    admin.from("org_members"),
    { org_id: orgId, user_id: owner.id, role: "org_admin" },
    "org_id,user_id",
  );
  await upsert(
    admin.from("org_members"),
    { org_id: orgId, user_id: manager.id, role: "manager" },
    "org_id,user_id",
  );

  let building = await admin
    .from("buildings")
    .select("id")
    .eq("org_id", orgId)
    .eq("code", BUILDING_CODE)
    .maybeSingle();

  if (!building.data) {
    const managerClient = createClient(env().url, env().anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${manager.token}` } },
    });
    const rows = [
      {
        row: "2",
        kind: "building",
        code: BUILDING_CODE,
        name: BUILDING_NAME,
        city: "Doha",
        country_code: "QA",
      },
      ...[1, 2, 3, 4].map((index) => ({
        row: String(index + 2),
        kind: "unit",
        building: BUILDING_CODE,
        floor: "0",
        unit_no: String(index).padStart(3, "0"),
        unit_type: "1br",
        area_sqm: "55",
        rent_minor: "450000",
      })),
    ];
    const { error } = await managerClient.rpc("import_property_rows", {
      p_rows: rows,
      p_dry_run: false,
    });
    if (error) throw new Error(`could not import the E2E property: ${error.message}`);

    building = await admin
      .from("buildings")
      .select("id")
      .eq("org_id", orgId)
      .eq("code", BUILDING_CODE)
      .maybeSingle();
  }

  const buildingId = building.data?.id as string;
  if (!buildingId) throw new Error("the E2E building was not created");

  await upsert(
    admin.from("member_building_access"),
    { org_id: orgId, user_id: manager.id, building_id: buildingId },
    "user_id,building_id",
  );

  const units = await admin
    .from("units")
    .select("id")
    .eq("building_id", buildingId)
    .is("deleted_at", null)
    .order("unit_no");
  const unitIds = (units.data ?? []).map((unit) => unit.id as string);
  const firstUnitId = unitIds[0];
  if (!firstUnitId) throw new Error("the E2E building has no units to list");

  // One deterministic public listing so the marketplace e2e suite has data.
  const listingSlug = `${ORG_SLUG}-tower-001`;
  const buildingUpdate = await admin
    .from("buildings")
    .update({ is_listed_publicly: true, listing_description: "A bright flat in Doha." })
    .eq("id", buildingId);
  if (buildingUpdate.error) throw new Error(buildingUpdate.error.message);
  const unitUpdate = await admin
    .from("units")
    .update({
      is_listed_publicly: true,
      status: "vacant",
      listing_title: `${BUILDING_NAME} 001`,
      listing_description: "Bright flat near the metro.",
      listing_slug: listingSlug,
      listed_at: new Date().toISOString(),
    })
    .eq("id", firstUnitId);
  if (unitUpdate.error) throw new Error(unitUpdate.error.message);

  return {
    orgId,
    ownerId: owner.id,
    managerId: manager.id,
    buildingId,
    unitIds,
    listingSlug,
  };
}
