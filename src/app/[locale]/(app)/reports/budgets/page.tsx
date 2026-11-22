import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { can, isRole } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";
import { fetchBudgetReport, upsertBudgetAction } from "@/server/actions/budgets";
import { fetchReportBuildings } from "@/server/actions/reports";
import { formatMoney } from "@/lib/money";

type SearchParams = Promise<{ month?: string; building?: string }>;

export default async function BudgetsReportPage({
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

  const { month: m, building: b } = await searchParams;
  const today = new Date().toISOString().slice(0, 7);
  const month = m && /^\d{4}-\d{2}$/.test(m) ? `${m}-01` : `${today}-01`;
  const buildingId = b ?? "";

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const t = await getTranslations("reports");

  const [report, buildings, accountsRes] = await Promise.all([
    fetchBudgetReport(month, buildingId),
    fetchReportBuildings(),
    ctx.supabase.from("accounts").select("id, code, name").order("code"),
  ]);
  const accounts = accountsRes.data ?? [];

  const writable = can(role, "finance.write");

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="reports"
        role={role}
        title={t("budgets")}
        description="Compare budgeted amounts against actual journal postings by account."
      />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardBody>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="month">Month</Label>
              <Input id="month" name="month" type="month" defaultValue={month.slice(0, 7)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="building">Building</Label>
              <select
                id="building"
                name="building"
                defaultValue={buildingId}
                className="rounded-xl border border-hairline bg-surface-container-lowest px-3 py-2 font-body-md text-body-md text-on-surface"
              >
                <option value="">All / company</option>
                {buildings.map((bld) => (
                  <option key={bld.id} value={bld.id}>
                    {bld.code} — {bld.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Apply</Button>
          </form>
        </CardBody>
      </Card>

      {writable ? (
        <Card>
          <CardHeader>
            <CardTitle>Add / update budget</CardTitle>
          </CardHeader>
          <CardBody>
            <form action={upsertBudgetAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="month" value={month} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="buildingId">Building</Label>
                <select
                  id="buildingId"
                  name="buildingId"
                  defaultValue={buildingId}
                  className="rounded-xl border border-hairline bg-surface-container-lowest px-3 py-2 font-body-md text-body-md text-on-surface"
                >
                  <option value="">All / company</option>
                  {buildings.map((bld) => (
                    <option key={bld.id} value={bld.id}>
                      {bld.code} — {bld.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="accountId">Account</Label>
                <select
                  id="accountId"
                  name="accountId"
                  className="rounded-xl border border-hairline bg-surface-container-lowest px-3 py-2 font-body-md text-body-md text-on-surface"
                  required
                >
                  <option value="">Select account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" step="0.01" required />
              </div>
              <Button type="submit">Save</Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Budget vs actual</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {!report ? (
            <p className="py-3 font-body-sm text-body-sm text-on-surface-variant">No data.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-start font-body-sm text-body-sm">
                <thead>
                  <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                    <th className="p-3 text-start">Account</th>
                    <th className="p-3 text-start">Type</th>
                    <th className="p-3 text-end">Budget</th>
                    <th className="p-3 text-end">Actual</th>
                    <th className="p-3 text-end">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {report.rows.map((r) => (
                    <tr key={r.accountId}>
                      <td className="p-3 font-medium text-on-surface">
                        {r.accountCode} — {r.accountName}
                      </td>
                      <td className="p-3 text-on-surface-variant">{r.accountType}</td>
                      <td className="p-3 text-end tabular">
                        {formatMoney(BigInt(r.budgetMinor), report.currency, locale)}
                      </td>
                      <td className="p-3 text-end tabular">
                        {formatMoney(BigInt(r.actualMinor), report.currency, locale)}
                      </td>
                      <td className="p-3 text-end tabular">
                        {formatMoney(BigInt(r.varianceMinor), report.currency, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}