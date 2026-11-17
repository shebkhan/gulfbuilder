"use server";

import { revalidatePath } from "next/cache";
import { toMinor } from "@/lib/money";
import { can } from "@/lib/rbac";
import { completeInspectionSchema, createInspectionSchema } from "@/schemas/inspections";
import { getOrgContext } from "@/server/org-context";

export type InspectionState = {
  error?: string;
  ok?: string;
  inspectionId?: string;
};

function fail(error: string): InspectionState {
  return { error };
}

export async function createInspectionAction(
  _prev: InspectionState,
  formData: FormData,
): Promise<InspectionState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "maintenance.write")) {
    return fail("not_authorised");
  }

  const parsed = createInspectionSchema.safeParse({
    leaseId: formData.get("leaseId"),
    kind: formData.get("kind"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) return fail("invalid_input");

  const { leaseId, kind, notes } = parsed.data;

  const { data: inspection, error } = await ctx.supabase
    .from("inspections")
    .insert({
      org_id: ctx.orgId,
      lease_id: leaseId,
      kind,
      notes: notes || undefined,
      inspector_id: ctx.userId,
    })
    .select("id")
    .single();

  if (error || !inspection) {
    return fail(error?.message || "inspection_creation_failed");
  }

  revalidatePath("/inspections");
  revalidatePath(`/leases/${leaseId}`);
  return { ok: "inspection_created", inspectionId: inspection.id };
}

export async function completeInspectionAction(
  _prev: InspectionState,
  formData: FormData,
): Promise<InspectionState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "maintenance.write")) {
    return fail("not_authorised");
  }

  const parsed = completeInspectionSchema.safeParse({
    inspectionId: formData.get("inspectionId"),
    checklistData: formData.get("checklistData") || "{}",
    deductAmount: formData.get("deductAmount") || undefined,
    deductReason: formData.get("deductReason") || undefined,
  });

  if (!parsed.success) return fail("invalid_input");

  const { inspectionId, checklistData, deductAmount, deductReason } = parsed.data;

  let deductMinor = 0n;
  if (deductAmount) {
    try {
      deductMinor = toMinor(deductAmount, "QAR");
    } catch {
      return fail("invalid_amount");
    }
  }

  let parsedData = {};
  try {
    parsedData = JSON.parse(checklistData);
  } catch {
    parsedData = { raw: checklistData };
  }

  const { error } = await ctx.supabase.rpc("complete_inspection", {
    p_inspection_id: inspectionId,
    p_data: parsedData,
    p_deduct_minor: Number(deductMinor),
    p_deduct_reason: deductReason || undefined,
  });

  if (error) return fail(error.message || "complete_failed");

  revalidatePath("/inspections");
  revalidatePath("/deposits");
  revalidatePath("/leases");
  return { ok: "inspection_completed", inspectionId };
}
