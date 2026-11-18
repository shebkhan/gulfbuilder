import type { NextRequest } from "next/server";
import { requireApiContext } from "@/lib/api/context";
import { route } from "@/lib/api/handler";
import { resolveOwnerScope } from "@/server/services/owner-api";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return route(request, async () => {
    const ctx = await requireApiContext(request);
    if (ctx.role !== "owner") throw new Error("forbidden");
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const decision = body?.decision === "rejected" ? "rejected" : "approved";
    const note = typeof body?.note === "string" ? body.note.slice(0, 300) : null;

    const scope = await resolveOwnerScope(ctx);
    // verify approval belongs to this owner
    const { data: approval } = await ctx.supabase
      .from("owner_expense_approvals")
      .select("id, owner_id, status")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .maybeSingle();
    if (!approval || !scope.ownerIds.includes(approval.owner_id)) throw new Error("not_found");
    if (approval.status !== "pending") throw new Error("already_decided");

    const { error } = await ctx.supabase
      .from("owner_expense_approvals")
      .update({ status: decision, decided_at: new Date().toISOString(), decided_by: ctx.userId, note })
      .eq("id", id);
    if (error) throw new Error("update_failed");
    return { ok: true, decision };
  }, { cache: "no-store" });
}
