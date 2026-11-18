"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/lib/rbac";
import { meterSchema, readingSchema } from "@/schemas/meters";
import { getOrgContext } from "@/server/org-context";

export type MeterState = {
  error?: string;
  ok?: string;
};

function fail(error: string): MeterState {
  return { error };
}

export async function createMeterAction(
  _prev: MeterState,
  formData: FormData,
): Promise<MeterState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "maintenance.write")) return fail("not_authorised");

  const parsed = meterSchema.safeParse({
    kind: formData.get("kind"),
    buildingId: formData.get("buildingId"),
    unitId: formData.get("unitId") || undefined,
    meterNo: formData.get("meterNo") || undefined,
  });
  if (!parsed.success) return fail("invalid_input");

  const { error } = await ctx.supabase.from("meters").insert({
    org_id: ctx.orgId,
    building_id: parsed.data.buildingId,
    unit_id: parsed.data.unitId || null,
    kind: parsed.data.kind,
    meter_no: parsed.data.meterNo,
  });
  if (error) return fail("failed");

  revalidatePath("/meters");
  return { ok: "created" };
}

export async function addMeterReadingAction(
  _prev: MeterState,
  formData: FormData,
): Promise<MeterState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "maintenance.write")) return fail("not_authorised");

  const parsed = readingSchema.safeParse({
    meterId: formData.get("meterId"),
    readOn: formData.get("readOn"),
    value: formData.get("value"),
  });
  if (!parsed.success) return fail("invalid_input");

  const value = Number(parsed.data.value);
  if (!Number.isFinite(value) || value < 0) return fail("invalid_value");

  const { error } = await ctx.supabase.from("meter_readings").insert({
    org_id: ctx.orgId,
    meter_id: parsed.data.meterId,
    read_on: parsed.data.readOn,
    value,
    read_by: ctx.userId,
  });
  if (error) return fail("failed");

  revalidatePath("/meters");
  return { ok: "recorded" };
}
