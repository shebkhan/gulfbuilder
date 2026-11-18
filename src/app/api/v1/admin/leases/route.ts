import type { NextRequest } from "next/server";
import { requireApiContext } from "@/lib/api/context";
import { route } from "@/lib/api/handler";
import { getAdminLeases } from "@/server/services/admin-api";

const ADMIN_ROLES = ["org_admin", "manager", "accountant"];
function isAdmin(role: string) { return ADMIN_ROLES.includes(role); }

export async function GET(request: NextRequest) {
  return route(request, async () => {
    const ctx = await requireApiContext(request);
    if (!isAdmin(ctx.role)) throw new Error("forbidden");
    const expiring = request.nextUrl.searchParams.get("expiring_days");
    return getAdminLeases(ctx, expiring ? Number(expiring) : undefined);
  }, { cache: "no-store" });
}
