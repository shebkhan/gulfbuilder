"use server";

import { renderToBuffer } from "@react-pdf/renderer";

import { can } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/server/org-context";
import { OwnerStatementPdf, type OwnerStatementPdfData } from "@/lib/pdf/owner-statement";

export type OwnerStatementPdfState = { error?: string; url?: string };

export async function generateOwnerStatementPdfAction(
  statementId: string,
): Promise<OwnerStatementPdfState> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "finance.read")) return { error: "not_authorised" };

  const supabase = await createSupabaseServerClient();
  const { data: statement } = await supabase
    .from("owner_statements")
    .select("id, owner_id, org_id, period_start, period_end, currency, status, opening_minor, closing_minor, totals, lines")
    .eq("id", statementId)
    .maybeSingle();
  if (!statement) return { error: "not_found" };

  const { data: branding } = await supabase
    .from("org_branding")
    .select("app_name")
    .eq("org_id", statement.org_id)
    .maybeSingle();

  const totals = (statement.totals ?? {}) as Record<string, number>;
  const lines = (statement.lines ?? []) as { kind?: string; description?: string; amount_minor?: number }[];

  const data: OwnerStatementPdfData = {
    orgName: branding?.app_name ?? "Gulf Property",
    periodStart: statement.period_start,
    periodEnd: statement.period_end,
    currency: statement.currency,
    status: statement.status,
    opening: statement.opening_minor,
    collections: Number(totals.collections ?? 0),
    expenses: Number(totals.expenses ?? 0),
    managementFee: Number(totals.management_fee ?? 0),
    netPayable: Number(totals.net_payable ?? statement.closing_minor),
    closing: statement.closing_minor,
    lines: lines.map((l) => ({
      kind: l.kind ?? "—",
      description: l.description ?? "—",
      amount: l.amount_minor ?? 0,
    })),
  };

  const buffer = await renderToBuffer(<OwnerStatementPdf data={data} />);
  const path = `${ctx.orgId}/owner-statements/${statementId}.pdf`;
  const { error: uploadError } = await ctx.supabase.storage
    .from("documents")
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) return { error: "upload_failed" };

  await ctx.supabase.from("documents").insert({
    org_id: ctx.orgId,
    entity_type: "owner_statement",
    entity_id: statementId,
    kind: "statement",
    path,
    uploaded_by: ctx.userId,
  });

  const { data: signed } = await ctx.supabase.storage.from("documents").createSignedUrl(path, 3600);
  return { url: signed?.signedUrl };
}