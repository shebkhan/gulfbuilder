"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toMinor } from "@/lib/money";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";
import type { Database } from "@/types/database";

export type MaintenanceState = {
  error?: string;
  ok?: string;
  requestId?: string;
};

type MaintPriority = Database["public"]["Enums"]["maint_priority"];
type MaintStatus = Database["public"]["Enums"]["maint_status"];

const createRequestSchema = z.object({
  buildingId: z.string().uuid(),
  unitId: z.string().uuid().optional().or(z.literal("")),
  roomId: z.string().uuid().optional().or(z.literal("")),
  tenantId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  category: z.string().trim().min(1).default("general"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  vendorId: z.string().uuid().optional().or(z.literal("")),
});

const updateStatusSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["open", "in_progress", "waiting_parts", "completed", "cancelled"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  cost: z.string().optional().or(z.literal("")),
});

function fail(error: string): MaintenanceState {
  return { error };
}

export async function createMaintenanceRequestAction(
  _prev: MaintenanceState,
  formData: FormData,
): Promise<MaintenanceState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "maintenance.write")) {
    return fail("not_authorised");
  }

  const parsed = createRequestSchema.safeParse({
    buildingId: formData.get("buildingId"),
    unitId: formData.get("unitId") || undefined,
    roomId: formData.get("roomId") || undefined,
    tenantId: formData.get("tenantId") || undefined,
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    category: formData.get("category") || "general",
    priority: formData.get("priority") || "normal",
    vendorId: formData.get("vendorId") || undefined,
  });

  if (!parsed.success) return fail("invalid_input");

  const { buildingId, unitId, roomId, tenantId, title, description, category, priority, vendorId } =
    parsed.data;

  const { data: requestId, error } = await ctx.supabase.rpc("create_maintenance_request", {
    p_building_id: buildingId,
    p_title: title,
    p_description: description || undefined,
    p_unit_id: unitId || undefined,
    p_room_id: roomId || undefined,
    p_tenant_id: tenantId || undefined,
    p_category: category,
    p_priority: priority as MaintPriority,
    p_assigned_vendor_id: vendorId || undefined,
  });

  if (error || !requestId) {
    return fail(error?.message || "request_creation_failed");
  }

  revalidatePath("/maintenance");
  if (unitId) revalidatePath(`/units/${unitId}`);
  return { ok: "request_created", requestId };
}

export async function updateMaintenanceStatusAction(
  _prev: MaintenanceState,
  formData: FormData,
): Promise<MaintenanceState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "maintenance.write")) {
    return fail("not_authorised");
  }

  const parsed = updateStatusSchema.safeParse({
    requestId: formData.get("requestId"),
    status: formData.get("status"),
    note: formData.get("note") || undefined,
    cost: formData.get("cost") || undefined,
  });

  if (!parsed.success) return fail("invalid_input");

  const { requestId, status, note, cost } = parsed.data;

  let costMinor: bigint | null = null;
  if (cost) {
    try {
      costMinor = toMinor(cost, "QAR");
    } catch {
      return fail("invalid_amount");
    }
  }

  const { error } = await ctx.supabase.rpc("update_maintenance_status", {
    p_request_id: requestId,
    p_status: status as MaintStatus,
    p_note: note || undefined,
    p_cost_minor: costMinor ? Number(costMinor) : undefined,
  });

  if (error) return fail(error.message || "status_update_failed");

  revalidatePath("/maintenance");
  return { ok: "status_updated", requestId };
}
