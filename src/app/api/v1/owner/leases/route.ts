import type { NextRequest } from "next/server";
import { requireApiContext } from "@/lib/api/context";
import { route } from "@/lib/api/handler";
import { getOwnerLeases } from "@/server/services/owner-api";

export async function GET(request: NextRequest) {
  return route(request, async () => {
    const ctx = await requireApiContext(request);
    if (ctx.role !== "owner") throw new Error("forbidden");
    const expiring = request.nextUrl.searchParams.get("expiring_days");
    return getOwnerLeases(ctx, expiring ? Number(expiring) : undefined);
  }, { cache: "no-store" });
}
