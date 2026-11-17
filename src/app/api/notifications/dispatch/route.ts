import { dispatchPending } from "@/server/notifications/dispatch";

export async function POST(request: Request) {
  const secret = process.env.NOTIFICATION_CRON_SECRET;
  if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await dispatchPending());
}
