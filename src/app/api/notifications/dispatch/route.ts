import { dispatchPending } from "@/server/notifications/dispatch";

export const runtime = "nodejs";

const dispatchBuckets = new Map<string, number[]>();

function dispatchRateLimit(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - 60_000;
  const hits = (dispatchBuckets.get(ip) ?? []).filter((t) => t > cutoff);
  if (hits.length >= 12) {
    dispatchBuckets.set(ip, hits);
    return false;
  }
  hits.push(now);
  dispatchBuckets.set(ip, hits);
  return true;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (!dispatchRateLimit(ip)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  const secret = process.env.NOTIFICATION_CRON_SECRET;
  if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await dispatchPending());
}
