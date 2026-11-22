import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { dispatchPending } from "@/server/notifications/dispatch";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { ok } = checkRateLimit(`dispatch:${clientIp(request)}`, 12, 60_000);
  if (!ok) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  const secret = process.env.NOTIFICATION_CRON_SECRET;
  if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await dispatchPending());
}
