"use server";

import { toCsv } from "@/lib/csv";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

export type ExportState = {
  error?: string;
  csv?: string;
  filename?: string;
};

/** Full data export (SPEC §8 A5). One dataset per call, streamed back as CSV. */
export async function exportDatasetAction(dataset: string): Promise<ExportState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "settings.write")) return { error: "not_authorised" };

  const supabase = ctx.supabase;

  switch (dataset) {
    case "tenants": {
      const { data } = await supabase
        .from("tenants")
        .select("id, full_name, kind, language, phone, email, nationality, employer, created_at")
        .order("full_name");
      return {
        csv: toCsv((data ?? []) as Record<string, unknown>[]),
        filename: `tenants-${ctx.orgId}.csv`,
      };
    }
    case "leases": {
      const { data } = await supabase
        .from("leases")
        .select(
          "id, lease_no, start_date, end_date, rent_minor, currency, deposit_minor, status, payment_frequency, tenant_id, unit_id, room_id",
        )
        .order("lease_no");
      return {
        csv: toCsv((data ?? []) as Record<string, unknown>[]),
        filename: `leases-${ctx.orgId}.csv`,
      };
    }
    case "charges": {
      const { data } = await supabase
        .from("charges")
        .select("id, lease_id, type, due_date, amount_minor, paid_minor, currency, status")
        .order("due_date");
      return {
        csv: toCsv((data ?? []) as Record<string, unknown>[]),
        filename: `charges-${ctx.orgId}.csv`,
      };
    }
    case "payments": {
      const { data } = await supabase
        .from("payments")
        .select("id, receipt_no, receipt_year, tenant_id, lease_id, amount_minor, currency, method, received_at, status")
        .order("received_at");
      return {
        csv: toCsv((data ?? []) as Record<string, unknown>[]),
        filename: `payments-${ctx.orgId}.csv`,
      };
    }
    case "journal_lines": {
      const { data } = await supabase
        .from("journal_lines")
        .select("id, journal_id, account_id, debit_minor, credit_minor, currency, tenant_id, lease_id, building_id, unit_id, description")
        .order("id");
      return {
        csv: toCsv((data ?? []) as Record<string, unknown>[]),
        filename: `journal-lines-${ctx.orgId}.csv`,
      };
    }
    default:
      return { error: "unknown_dataset" };
  }
}
