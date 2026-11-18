import type { NextRequest } from "next/server";
import { requireApiContext } from "@/lib/api/context";
import { route } from "@/lib/api/handler";
import { getAdminMaintenance } from "@/server/services/admin-api";

const ADMIN_ROLES = ["org_admin", "manager", "accountant"];
function isAdmin(role: string) { return ADMIN_ROLES.includes(role); }

export async function GET(request: NextRequest) {
  return route(request, async () => {
    const ctx = await requireApiContext(request);
    if (!isAdmin(ctx.role)) throw new Error("forbidden");
    return getAdminMaintenance(ctx);
  }, { cache: "no-store" });
}
