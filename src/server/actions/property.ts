"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseCsv } from "@/lib/csv";
import { IMPORT_HEADERS, toImportRows } from "@/lib/import-rows";
import { toMinor } from "@/lib/money";
import { can } from "@/lib/rbac";
import { buildingSchema, floorsSchema, unitsSchema } from "@/schemas/property";
import { getOrgContext } from "@/server/org-context";

export type ImportReport = {
  dry_run: boolean;
  committed: boolean;
  buildings: number;
  floors: number;
  units: number;
  errors: { row: string; message: string }[];
};

export type PropertyState = { error?: string; ok?: string; report?: ImportReport };

function fail(error: string): PropertyState {
  return { error };
}

export async function createBuildingAction(
  _prev: PropertyState,
  formData: FormData,
): Promise<PropertyState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "properties.write")) return fail("not_authorised");

  const parsed = buildingSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    ownerId: formData.get("ownerId"),
    city: formData.get("city") || undefined,
  });
  if (!parsed.success) return fail("invalid_input");

  const { error } = await ctx.supabase.from("buildings").insert({
    org_id: ctx.orgId,
    owner_id: parsed.data.ownerId,
    code: parsed.data.code,
    name: parsed.data.name,
    city: parsed.data.city ?? null,
    country_code: "QA",
    created_by: ctx.userId,
  });
  if (error) return fail(error.code === "23505" ? "duplicate_code" : "failed");

  revalidatePath("/buildings");
  return { ok: "created" };
}

export async function generateFloorsAction(
  _prev: PropertyState,
  formData: FormData,
): Promise<PropertyState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "properties.write")) return fail("not_authorised");

  const parsed = floorsSchema.safeParse({
    buildingId: formData.get("buildingId"),
    from: formData.get("from"),
    to: formData.get("to"),
  });
  if (!parsed.success) return fail("invalid_range");

  const { data, error } = await ctx.supabase.rpc("generate_floors", {
    p_building: parsed.data.buildingId,
    p_from: parsed.data.from,
    p_to: parsed.data.to,
  });
  if (error) return fail("failed");

  revalidatePath(`/buildings/${parsed.data.buildingId}`);
  return { ok: String(data ?? 0) };
}

export async function generateUnitsAction(
  _prev: PropertyState,
  formData: FormData,
): Promise<PropertyState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "properties.write")) return fail("not_authorised");

  const parsed = unitsSchema.safeParse({
    floorId: formData.get("floorId"),
    prefix: formData.get("prefix") || undefined,
    start: formData.get("start") || undefined,
    count: formData.get("count") || undefined,
    pad: formData.get("pad") || undefined,
    unitType: formData.get("unitType") || undefined,
    areaSqm: formData.get("areaSqm") || undefined,
    rent: formData.get("rent") || undefined,
  });
  if (!parsed.success) return fail("invalid_input");

  const { data: org } = await ctx.supabase
    .from("organizations")
    .select("base_currency")
    .eq("id", ctx.orgId)
    .maybeSingle();
  const currency = org?.base_currency ?? "QAR";

  let rentMinor: number | null = null;
  if (parsed.data.rent) {
    try {
      rentMinor = Number(toMinor(parsed.data.rent, currency));
    } catch {
      return fail("invalid_rent");
    }
  }

  const { data, error } = await ctx.supabase.rpc("generate_units", {
    p_floor: parsed.data.floorId,
    p_prefix: parsed.data.prefix || undefined,
    p_start: parsed.data.start,
    p_count: parsed.data.count,
    p_pad: parsed.data.pad,
    p_unit_type: parsed.data.unitType || undefined,
    p_area_sqm: parsed.data.areaSqm ?? undefined,
    p_rent_minor: rentMinor ?? undefined,
  });
  if (error) return fail("failed");

  revalidatePath("/buildings", "layout");
  return { ok: String(data ?? 0) };
}

export async function importPropertiesAction(
  _prev: PropertyState,
  formData: FormData,
): Promise<PropertyState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "properties.write")) return fail("not_authorised");

  const file = formData.get("file");
  const dryRun = formData.get("mode") !== "commit";
  if (!(file instanceof File) || file.size === 0) return fail("missing_file");

  const { data: org } = await ctx.supabase
    .from("organizations")
    .select("base_currency")
    .eq("id", ctx.orgId)
    .maybeSingle();
  const currency = org?.base_currency ?? "QAR";

  const csv = parseCsv(await file.text());
  const missing = IMPORT_HEADERS.filter((header) => !(header in (csv[0] ?? {})));
  if (csv.length > 0 && missing.length > 0) return fail("bad_header");

  const { rows, errors } = toImportRows(csv, currency);

  const { data, error } = await ctx.supabase.rpc("import_property_rows", {
    p_rows: rows,
    p_dry_run: dryRun,
  });
  if (error) return fail("failed");

  const report = data as unknown as ImportReport;
  report.errors = [...errors, ...(report.errors ?? [])];

  if (report.committed) revalidatePath("/buildings", "layout");
  return { report };
}

export async function grantBuildingAccessAction(
  _prev: PropertyState,
  formData: FormData,
): Promise<PropertyState> {
  const ctx = await getOrgContext();
  if (!ctx || ctx.role !== "org_admin") return fail("not_authorised");

  const parsed = z
    .object({ buildingId: z.string().uuid(), userId: z.string().uuid() })
    .safeParse({
      buildingId: formData.get("buildingId"),
      userId: formData.get("userId"),
    });
  if (!parsed.success) return fail("invalid_input");

  const { error } = await ctx.supabase.from("member_building_access").insert({
    org_id: ctx.orgId,
    building_id: parsed.data.buildingId,
    user_id: parsed.data.userId,
    created_by: ctx.userId,
  });
  if (error) return fail(error.code === "23505" ? "already_granted" : "failed");

  revalidatePath(`/buildings/${parsed.data.buildingId}`);
  return { ok: "granted" };
}

export async function revokeBuildingAccessAction(formData: FormData): Promise<void> {
  const ctx = await getOrgContext();
  if (!ctx || ctx.role !== "org_admin") return;

  const buildingId = z.string().uuid().safeParse(formData.get("buildingId"));
  const userId = z.string().uuid().safeParse(formData.get("userId"));
  if (!buildingId.success || !userId.success) return;

  await ctx.supabase
    .from("member_building_access")
    .delete()
    .eq("building_id", buildingId.data)
    .eq("user_id", userId.data);

  revalidatePath(`/buildings/${buildingId.data}`);
}
