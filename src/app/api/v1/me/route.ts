import type { NextRequest } from "next/server";
import { requireApiContext } from "@/lib/api/context";
import { route } from "@/lib/api/handler";

export async function GET(request: NextRequest) {
  return route(request, async () => {
    const ctx = await requireApiContext(request);
    return {
      user: { id: ctx.userId },
      organization: { id: ctx.orgId },
      role: ctx.role,
    };
  });
}
