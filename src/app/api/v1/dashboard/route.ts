import type { NextRequest } from "next/server";
import { requireApiContext } from "@/lib/api/context";
import { route } from "@/lib/api/handler";
import { getDashboard } from "@/server/services/dashboard";

export async function GET(request: NextRequest) {
  return route(
    request,
    async () => {
      const ctx = await requireApiContext(request);
      return getDashboard(ctx);
    },
    // Rent roll and collections: never stored by a browser, proxy or phone.
    { cache: "no-store" },
  );
}
