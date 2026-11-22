"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toMinor } from "@/lib/money";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";
import { parseCsv } from "@/lib/csv";

export type BankingState = { error?: string; ok?: string; imported?: number };

const matchSchema = z.object({
  txnId: z.string().uuid(),
  type: z.enum(["payment", "cheque", "expense"]),
  id: z.string().uuid(),
});

export async function importBankTransactionsAction(formData: FormData): Promise<void> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "finance.write")) return;

  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) return;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const { data: account } = await ctx.supabase
    .from("bank_accounts")
    .select("id, currency")
    .eq("id", accountId)
    .maybeSingle();
  if (!account) return;

  const currency = account.currency;
  const csv = parseCsv(await file.text());
  if (csv.length === 0) return;

  const rows: { bank_account_id: string; txn_date: string; description: string; amount_minor: number; org_id: string }[] =
    [];
  for (const row of csv) {
    const date = row.date || row.txn_date || row["transaction date"];
    const desc = row.description || row.desc || row.memo || "";
    const amt = row.amount || row.value;
    if (!date || amt === undefined) continue;
    let amountMinor: number;
    try {
      amountMinor = Number(toMinor(String(amt), currency));
    } catch {
      continue;
    }
    rows.push({
      org_id: ctx.orgId,
      bank_account_id: accountId,
      txn_date: date,
      description: desc,
      amount_minor: amountMinor,
    });
  }
  if (rows.length === 0) return;

  const { error } = await (ctx.supabase as any).from("bank_transactions").insert(rows);
  if (error) return;

  revalidatePath("/reports/reconciliation");
}

export async function matchBankTransactionAction(formData: FormData): Promise<void> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "finance.write")) return;

  const parsed = matchSchema.safeParse({
    txnId: formData.get("txnId"),
    type: formData.get("type"),
    id: formData.get("id"),
  });
  if (!parsed.success) return;

  await (ctx.supabase as any)
    .from("bank_transactions")
    .update({ matched_type: parsed.data.type, matched_id: parsed.data.id })
    .eq("id", parsed.data.txnId);

  revalidatePath("/reports/reconciliation");
}

export async function unmatchBankTransactionAction(formData: FormData): Promise<void> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "finance.write")) return;
  const txnId = String(formData.get("txnId") ?? "");
  if (!txnId) return;
  await (ctx.supabase as any)
    .from("bank_transactions")
    .update({ matched_type: null, matched_id: null })
    .eq("id", txnId);
  revalidatePath("/reports/reconciliation");
}