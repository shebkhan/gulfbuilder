import type { NextRequest } from "next/server";
import { requireApiContext } from "@/lib/api/context";
import { route } from "@/lib/api/handler";
import { createTenantMaintenance } from "@/server/services/tenant-api";

export async function POST(request: NextRequest) {
  return route(request, async () => {
    const ctx = await requireApiContext(request);
    if (ctx.role !== "tenant") throw new Error("forbidden");
    const body = await request.json().catch(() => ({}));
    return createTenantMaintenance(ctx, body);
  }, { cache: "no-store" });
}
