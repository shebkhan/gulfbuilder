import type { NextRequest } from "next/server";
import { requireApiContext } from "@/lib/api/context";
import { route } from "@/lib/api/handler";
import { getOwnerMaintenance } from "@/server/services/owner-api";
import { resolveOwnerScope } from "@/server/services/owner-api";

export async function GET(request: NextRequest) {
  return route(request, async () => {
    const ctx = await requireApiContext(request);
    if (ctx.role !== "owner") throw new Error("forbidden");
    return getOwnerMaintenance(ctx);
  }, { cache: "no-store" });
}

export async function POST(request: NextRequest) {
  return route(request, async () => {
    const ctx = await requireApiContext(request);
    if (ctx.role !== "owner") throw new Error("forbidden");
    const scope = await resolveOwnerScope(ctx);
    if (scope.buildingIds.length === 0) throw new Error("no_buildings");

    const body = await request.json().catch(() => ({}));
    const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 200) : "Maintenance request (via bot)";
    const description = typeof body?.description === "string" ? body.description.slice(0, 2000) : null;
    const buildingId = typeof body?.building_id === "string" ? body.building_id : scope.buildingIds[0];
    const unitId = typeof body?.unit_id === "string" ? body.unit_id : null;
    const priority = ["low", "normal", "high", "urgent"].includes(body?.priority) ? body.priority : "normal";

    if (!scope.buildingIds.includes(buildingId)) throw new Error("forbidden");

    const { data, error } = await ctx.supabase
      .from("maintenance_requests")
      .insert({
        org_id: ctx.orgId,
        building_id: buildingId,
        unit_id: unitId,
        title,
        description,
        priority,
        status: "open",
        opened_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) throw new Error("create_failed");
    return { ok: true, id: data.id };
  }, { cache: "no-store" });
}
