import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.REPORT_CRON_SECRET ?? process.env.NOTIFICATION_CRON_SECRET;
  if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("refresh_building_occupancy_mv");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}