import { CheckCircle2, Clock, Receipt } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExpenseList, type ExpenseItem } from "@/components/domain/expense-form";
import { ListPagination } from "@/components/domain/list-pagination";
import { Card, CardBody, KpiLabel } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { PAGE_SIZE, getPaginationRange, toPaginated } from "@/lib/pagination";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";

type SearchParams = Promise<{
  status?: string;
  category?: string;
  page?: string;
}>;

export default async function ExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const { page, status, category } = await searchParams;
  const t = await getTranslations("expenses");
  const tCommon = await getTranslations("common");

  const canWrite = can(ctx.role, "expenses.write");
  const canApprove = can(ctx.role, "expenses.approve");
  const canPay = ["org_admin", "accountant"].includes(ctx.role);

  const currentPage = Math.max(1, Number(page ?? 1));
  const { from, to } = getPaginationRange(currentPage, PAGE_SIZE);

  let aggregateQuery = ctx.supabase.from("expenses").select("amount_minor, status");
  let pageQuery = ctx.supabase
    .from("expenses")
    .select(
      `
      id,
      category,
      description,
      amount_minor,
      currency,
      status,
      expense_date,
      paid_at,
      vendors ( id, name ),
      buildings ( id, name, code ),
      units ( id, unit_no )
    `,
      { count: "exact" },
    )
    .order("expense_date", { ascending: false });

  if (status && status !== "all") {
    aggregateQuery = aggregateQuery.eq("status", status as never);
    pageQuery = pageQuery.eq("status", status as never);
  }

  if (category && category !== "all") {
    aggregateQuery = aggregateQuery.eq("category", category);
    pageQuery = pageQuery.eq("category", category);
  }

  const [{ data: allExpenses }, { data: expenses, count }] = await Promise.all([
    aggregateQuery,
    pageQuery.range(from, to),
  ]);

  const aggregateRows = allExpenses ?? [];
  const totalExpenseMinor = aggregateRows.reduce((acc, e) => acc + BigInt(e.amount_minor), 0n);
  const pendingApprovalMinor = aggregateRows
    .filter((e) => e.status === "submitted")
    .reduce((acc, e) => acc + BigInt(e.amount_minor), 0n);
  const paidMinor = aggregateRows
    .filter((e) => e.status === "paid")
    .reduce((acc, e) => acc + BigInt(e.amount_minor), 0n);

  const transformedExpenses: ExpenseItem[] = (expenses ?? []).map((e) => ({
    id: e.id,
    category: e.category,
    description: e.description,
    amount_minor: e.amount_minor,
    currency: e.currency,
    status: e.status as ExpenseItem["status"],
    expense_date: e.expense_date,
    paid_at: e.paid_at,
    vendor: e.vendors as unknown as { id: string; name: string } | null,
    building: e.buildings as unknown as { id: string; name: string; code: string } | null,
    unit: e.units as unknown as { id: string; unit_no: string } | null,
  }));

  const paged = toPaginated(transformedExpenses, count, currentPage);

  const filterTabs = [
    { key: "all", label: tCommon("all") },
    { key: "submitted", label: t("statuses.submitted") },
    { key: "approved", label: t("statuses.approved") },
    { key: "paid", label: t("statuses.paid") },
  ];

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="expenses"
        role={ctx.role}
        title={t("title")}
        description={t("subtitle")}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-fixed/40 text-primary">
              <Receipt className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("kpis.totalExpenses")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(totalExpenseMinor, ctx.currency, locale)}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-tertiary-fixed/40 text-tertiary">
              <Clock className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("kpis.pendingApproval")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(pendingApprovalMinor, ctx.currency, locale)}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-secondary-container/60 text-secondary">
              <CheckCircle2 className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("kpis.disbursed")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(paidMinor, ctx.currency, locale)}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline pb-2">
        {filterTabs.map((tab) => {
          const isActive = (!status && tab.key === "all") || status === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.key === "all" ? "/expenses" : `/expenses?status=${tab.key}`}
              className={`rounded-full px-4 py-1.5 font-label-md text-label-md transition-colors ${
                isActive
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <ExpenseList
        expenses={paged.rows}
        canWrite={canWrite}
        canApprove={canApprove}
        canPay={canPay}
        locale={locale}
      />

      <ListPagination
        page={paged.page}
        pages={paged.pages}
        total={paged.total}
        href="/expenses"
        params={{ status, category }}
      />
    </div>
  );
}
