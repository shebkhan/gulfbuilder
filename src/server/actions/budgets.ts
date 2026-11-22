"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toMinor } from "@/lib/money";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

export type BudgetRow = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  budgetMinor: number;
  actualMinor: number;
  varianceMinor: number;
};

export type BudgetReport = {
  month: string; // YYYY-MM-01
  currency: string;
  buildingId: string;
  rows: BudgetRow[];
};

export type BudgetState = { error?: string; ok?: string };

const upsertSchema = z.object({
  buildingId: z.string().uuid().optional().or(z.literal("")),
  accountId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}-01$/),
  amount: z.string().min(1),
});

export async function fetchBudgetReport(
  month: string,
  buildingId: string,
): Promise<BudgetReport | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const { data: org } = await ctx.supabase
    .from("organizations")
    .select("base_currency")
    .eq("id", ctx.orgId)
    .maybeSingle();
  const currency = org?.base_currency ?? "QAR";

  const { data: accounts } = await ctx.supabase
    .from("accounts")
    .select("id, code, name, type")
    .order("code");

  // Budgets for the period.
  let budgetQuery = (ctx.supabase as any)
    .from("budgets")
    .select("account_id, amount_minor")
    .eq("month", month);
  if (buildingId) budgetQuery = budgetQuery.eq("building_id", buildingId);
  else budgetQuery = budgetQuery.is("building_id", null);
  const { data: budgets } = await budgetQuery;

  const budgetMap = new Map<string, number>();
  for (const b of budgets ?? []) budgetMap.set(b.account_id, Number(b.amount_minor));

  // Actuals from journal_lines for the month.
  const start = month;
  const end = new Date(month);
  end.setMonth(end.getMonth() + 1);
  const endIso = end.toISOString().slice(0, 10);

  let actualQuery = ctx.supabase
    .from("journal_lines")
    .select("account_id, debit_minor, credit_minor, journals!inner(posted_on)");
  // Filter posted_on via join is not directly supported; fetch and filter in JS.
  const { data: lines } = await actualQuery;

  const actualMap = new Map<string, number>();
  for (const line of lines ?? []) {
    const posted = (line as unknown as { journals: { posted_on: string } }).journals?.posted_on;
    if (!posted || posted < start || posted >= endIso) continue;
    const debit = Number(line.debit_minor ?? 0);
    const credit = Number(line.credit_minor ?? 0);
    // For expense accounts, actual = debits; for income, credits. Use net (debit-credit) absolute.
    const net = debit - credit;
    actualMap.set(line.account_id, (actualMap.get(line.account_id) ?? 0) + net);
  }

  const rows: BudgetRow[] = (accounts ?? []).map((a) => {
    const budgetMinor = budgetMap.get(a.id) ?? 0;
    const actualMinor = actualMap.get(a.id) ?? 0;
    return {
      accountId: a.id,
      accountCode: a.code,
      accountName: a.name,
      accountType: a.type,
      budgetMinor,
      actualMinor,
      varianceMinor: budgetMinor - actualMinor,
    };
  });

  return { month, currency, buildingId, rows };
}

export async function upsertBudgetAction(formData: FormData): Promise<void> {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "finance.write")) return;
  // Only accountant/admin/manager can write budgets.
  if (!can(ctx.role, "finance.write")) return;

  const parsed = upsertSchema.safeParse({
    buildingId: formData.get("buildingId") ?? "",
    accountId: formData.get("accountId"),
    month: formData.get("month"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) return;

  const { data: org } = await ctx.supabase
    .from("organizations")
    .select("base_currency")
    .eq("id", ctx.orgId)
    .maybeSingle();
  const currency = org?.base_currency ?? "QAR";

  let amountMinor: number;
  try {
    amountMinor = Number(toMinor(parsed.data.amount, currency));
  } catch {
    return;
  }

  const buildingId = parsed.data.buildingId === "" ? null : parsed.data.buildingId;

  const { error } = await (ctx.supabase as any).from("budgets").upsert(
    {
      org_id: ctx.orgId,
      building_id: buildingId,
      account_id: parsed.data.accountId,
      month: parsed.data.month,
      amount_minor: amountMinor,
      currency,
    },
    { onConflict: "org_id,building_id,account_id,month" },
  );
  if (error) return;

  revalidatePath("/reports/budgets");
}