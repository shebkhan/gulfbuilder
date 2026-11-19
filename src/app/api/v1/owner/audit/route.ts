import type { NextRequest } from "next/server";
import { requireApiContext } from "@/lib/api/context";
import { route } from "@/lib/api/handler";

export async function POST(request: NextRequest) {
  return route(request, async () => {
    const ctx = await requireApiContext(request);
    if (ctx.role !== "owner") throw new Error("forbidden");
    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action.slice(0, 100) : "bot_query";
    const detail = typeof body?.detail === "string" ? body.detail.slice(0, 500) : null;
    await ctx.supabase.from("audit_log").insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      table_name: "bot",
      action,
      new_data: detail ? { detail } : null,
    });
    return { ok: true };
  }, { cache: "no-store" });
}
