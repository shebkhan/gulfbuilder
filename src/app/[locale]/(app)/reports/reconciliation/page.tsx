import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { can, isRole } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";
import { importBankTransactionsAction, matchBankTransactionAction, unmatchBankTransactionAction } from "@/server/actions/banking";
import { formatMoney } from "@/lib/money";

type SearchParams = Promise<{ account?: string }>;

export default async function ReconciliationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const role = membership && isRole(membership.role) ? membership.role : "tenant";
  if (!can(role, "finance.read")) redirect(`/${locale}/dashboard`);

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const { account: accountId } = await searchParams;

  const [{ data: accounts }, { data: txns }] = await Promise.all([
    ctx.supabase.from("bank_accounts").select("id, name, currency").order("name"),
    accountId
      ? (ctx.supabase as any)
          .from("bank_transactions")
          .select("id, txn_date, description, amount_minor, matched_type, matched_id")
          .eq("bank_account_id", accountId)
          .order("txn_date", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const writable = can(role, "finance.write");
  const currency = accounts?.find((a) => a.id === accountId)?.currency ?? "QAR";

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="reports"
        role={role}
        title="Bank reconciliation"
        description="Import bank statements and match transactions to payments."
      />

      <Card>
        <CardHeader>
          <CardTitle>Bank account</CardTitle>
        </CardHeader>
        <CardBody>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account">Account</Label>
              <select
                id="account"
                name="account"
                defaultValue={accountId ?? ""}
                className="rounded-xl border border-hairline bg-surface-container-lowest px-3 py-2 font-body-md text-body-md text-on-surface"
              >
                <option value="">Select account</option>
                {(accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Load</Button>
          </form>
        </CardBody>
      </Card>

      {accountId && writable ? (
        <Card>
          <CardHeader>
            <CardTitle>Import CSV</CardTitle>
          </CardHeader>
          <CardBody>
            <form action={importBankTransactionsAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="accountId" value={accountId} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="file">CSV file (date, description, amount)</Label>
                <Input id="file" name="file" type="file" accept=".csv,text/csv" />
              </div>
              <Button type="submit">Import</Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      {accountId ? (
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            {!txns || txns.length === 0 ? (
              <p className="py-3 font-body-sm text-body-sm text-on-surface-variant">No transactions.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-start font-body-sm text-body-sm">
                  <thead>
                    <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                      <th className="p-3 text-start">Date</th>
                      <th className="p-3 text-start">Description</th>
                      <th className="p-3 text-end">Amount</th>
                      <th className="p-3 text-start">Matched</th>
                      <th className="p-3 text-start">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {(txns ?? []).map((txn: any) => (
                      <tr key={txn.id}>
                        <td className="p-3 text-on-surface-variant">{txn.txn_date}</td>
                        <td className="p-3 text-on-surface">{txn.description}</td>
                        <td className="p-3 text-end tabular">
                          {formatMoney(BigInt(txn.amount_minor), currency, locale)}
                        </td>
                        <td className="p-3 text-on-surface-variant">
                          {txn.matched_type ? `${txn.matched_type}: ${txn.matched_id}` : "—"}
                        </td>
                        <td className="p-3">
                          {writable ? (
                            txn.matched_type ? (
                              <form action={unmatchBankTransactionAction}>
                                <input type="hidden" name="txnId" value={txn.id} />
                                <Button type="submit" size="sm" variant="ghost">
                                  Unmatch
                                </Button>
                              </form>
                            ) : (
                              <form action={matchBankTransactionAction} className="flex items-center gap-2">
                                <input type="hidden" name="txnId" value={txn.id} />
                                <input type="hidden" name="type" value="payment" />
                                <Input name="id" placeholder="Payment UUID" className="h-8 w-48" />
                                <Button type="submit" size="sm">
                                  Match
                                </Button>
                              </form>
                            )
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}