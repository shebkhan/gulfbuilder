import type { NextRequest } from "next/server";
import { requireApiContext } from "@/lib/api/context";
import { route } from "@/lib/api/handler";
import { getOwnerChequesDue } from "@/server/services/owner-api";

export async function GET(request: NextRequest) {
  return route(request, async () => {
    const ctx = await requireApiContext(request);
    if (ctx.role !== "owner") throw new Error("forbidden");
    const days = Number(request.nextUrl.searchParams.get("days") ?? "30");
    return getOwnerChequesDue(ctx, Number.isFinite(days) ? days : 30);
  }, { cache: "no-store" });
}
