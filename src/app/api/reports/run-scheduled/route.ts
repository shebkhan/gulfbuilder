import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function nextRun(frequency: string, from: Date): Date {
  const d = new Date(from);
  if (frequency === "daily") d.setDate(d.getDate() + 1);
  else if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setDate(d.getDate() + 1);
  return d;
}

async function buildCsv(key: string, orgId: string, admin: any): Promise<string | null> {
  if (key === "occupancy") {
    const { data: buildings } = await admin.from("buildings").select("id, code, name").eq("org_id", orgId).is("deleted_at", null);
    const { data: units } = await admin.from("units").select("id, building_id, status").eq("org_id", orgId).is("deleted_at", null);
    const lines = ["building_code,building_name,total,occupied,vacant,occupancy_pct"];
    for (const b of buildings ?? []) {
      const us = (units ?? []).filter((u: any) => u.building_id === b.id);
      const total = us.length;
      const occupied = us.filter((u: any) => u.status === "occupied").length;
      const vacant = us.filter((u: any) => u.status === "vacant").length;
      const pct = total ? Math.round((occupied / total) * 100) : 0;
      lines.push(`${b.code},${b.name},${total},${occupied},${vacant},${pct}`);
    }
    return lines.join("\n");
  }

  if (key === "aged-receivables") {
    const { data: charges } = await admin
      .from("charges")
      .select("id, lease_id, type, due_date, amount_minor, paid_minor, status, leases(tenant_id, tenants(full_name))")
      .eq("org_id", orgId);
    const today = new Date().toISOString().slice(0, 10);
    const lines = ["tenant,charge_type,due_date,amount_minor,paid_minor,status,overdue_days"];
    for (const c of charges ?? []) {
      if (c.status === "paid" || c.status === "void") continue;
      const overdue = Math.max(0, Math.floor((new Date(today).getTime() - new Date(c.due_date).getTime()) / 86400000));
      const lease = c.leases as any;
      const tenantName = lease?.tenants?.full_name ?? "—";
      lines.push(`${tenantName},${c.type},${c.due_date},${c.amount_minor},${c.paid_minor},${c.status},${overdue}`);
    }
    return lines.join("\n");
  }

  if (key === "rent-roll") {
    const { data: leases } = await admin
      .from("leases")
      .select("id, lease_no, start_date, end_date, rent_minor, currency, status, units(unit_no, buildings(code)), tenants(full_name)")
      .eq("org_id", orgId);
    const lines = ["lease_no,tenant,unit,building,rent_minor,currency,start,end,status"];
    for (const l of leases ?? []) {
      const unit = (l as any).units;
      const building = unit?.buildings;
      const tenant = (l as any).tenants?.full_name ?? "—";
      lines.push(
        `${l.lease_no},${tenant},${unit?.unit_no ?? ""},${building?.code ?? ""},${l.rent_minor},${l.currency},${l.start_date},${l.end_date},${l.status}`,
      );
    }
    return lines.join("\n");
  }

  return null;
}

export async function POST(request: Request) {
  const secret = process.env.REPORT_CRON_SECRET ?? process.env.NOTIFICATION_CRON_SECRET;
  if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: jobs, error } = await admin
    .from("scheduled_reports")
    .select("id, org_id, recipients, frequency, next_run, report_definitions(name, report_key)")
    .eq("active", true)
    .lte("next_run", now);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let ran = 0;
  let skipped = 0;
  for (const job of jobs ?? []) {
    const def = (job as any).report_definitions;
    const key = def?.report_key;
    const csv = await buildCsv(key, job.org_id, admin);
    if (!csv) {
      skipped += 1;
      continue;
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.NOTIFICATION_FROM_EMAIL;
    if (apiKey && from && (job.recipients ?? []).length) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: job.recipients,
          subject: `Scheduled report: ${def?.name ?? key}`,
          text: "Attached is your scheduled report (CSV).",
          attachments: [{ filename: `${key}.csv`, content: Buffer.from(csv).toString("base64") }],
        }),
      }).catch(() => undefined);
    }

    const nr = nextRun(job.frequency, new Date(job.next_run));
    await admin.from("scheduled_reports").update({ next_run: nr.toISOString() }).eq("id", job.id);
    ran += 1;
  }

  return Response.json({ ran, skipped, total: (jobs ?? []).length });
}
