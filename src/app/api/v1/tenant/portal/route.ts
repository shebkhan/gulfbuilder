import type { NextRequest } from "next/server";
import { requireApiContext } from "@/lib/api/context";
import { route } from "@/lib/api/handler";
import { getTenantPortalData } from "@/server/services/tenant-api";

export async function GET(request: NextRequest) {
  return route(request, async () => {
    const ctx = await requireApiContext(request);
    if (ctx.role !== "tenant") throw new Error("forbidden");
    return getTenantPortalData(ctx);
  }, { cache: "no-store" });
}
