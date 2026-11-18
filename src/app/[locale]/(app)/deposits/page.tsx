import { MinusCircle, PiggyBank, RotateCcw } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DepositCard, type DepositItem } from "@/components/domain/deposit-card";
import { ListPagination } from "@/components/domain/list-pagination";
import { Card, CardBody, KpiLabel } from "@/components/ui/card";
import { PAGE_SIZE, getPaginationRange, toPaginated } from "@/lib/pagination";
import { formatMoney } from "@/lib/money";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";

type SearchParams = Promise<{ page?: string }>;

export default async function DepositsPage({
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

  const { page } = await searchParams;
  const t = await getTranslations("deposits");
  const writable = ["org_admin", "manager"].includes(ctx.role);

  const currentPage = Math.max(1, Number(page ?? 1));
  const { from, to } = getPaginationRange(currentPage, PAGE_SIZE);

  // KPI totals scan scalar-only rows; the page query fetches joined rows for the visible slice.
  const [{ data: allDeposits }, { data: deposits, count }] = await Promise.all([
    ctx.supabase.from("deposits").select("held_minor, deducted_minor, refunded_minor"),
    ctx.supabase
      .from("deposits")
      .select(
        `
      id,
      amount_minor,
      held_minor,
      deducted_minor,
      refunded_minor,
      currency,
      notes,
      tenants ( id, full_name ),
      leases ( id, lease_no )
    `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, to),
  ]);

  const aggregateRows = allDeposits ?? [];
  const totalHeldMinor = aggregateRows.reduce((acc, d) => acc + BigInt(d.held_minor), 0n);
  const totalDeductedMinor = aggregateRows.reduce(
    (acc, d) => acc + BigInt(d.deducted_minor),
    0n,
  );
  const totalRefundedMinor = aggregateRows.reduce(
    (acc, d) => acc + BigInt(d.refunded_minor),
    0n,
  );

  const transformedDeposits: DepositItem[] = (deposits ?? []).map((d) => ({
    id: d.id,
    amount_minor: d.amount_minor,
    held_minor: d.held_minor,
    deducted_minor: d.deducted_minor,
    refunded_minor: d.refunded_minor,
    currency: d.currency,
    notes: d.notes,
    tenant: d.tenants as unknown as { id: string; full_name: string } | null,
    lease: d.leases as unknown as { id: string; lease_no: string } | null,
  }));

  const paged = toPaginated(transformedDeposits, count, currentPage);

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="deposits"
        role={ctx.role}
        title={t("title")}
        description={t("subtitle")}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-fixed/40 text-primary">
              <PiggyBank className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("kpis.totalHeldInEscrow")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(totalHeldMinor, ctx.currency, locale)}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-error-container text-error">
              <MinusCircle className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("kpis.deductionsApplied")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(totalDeductedMinor, ctx.currency, locale)}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-secondary-container/60 text-secondary">
              <RotateCcw className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("kpis.refundsDisbursed")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(totalRefundedMinor, ctx.currency, locale)}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      <DepositCard
        deposits={paged.rows}
        writable={writable}
        locale={locale}
      />

      <ListPagination
        page={paged.page}
        pages={paged.pages}
        total={paged.total}
        href="/deposits"
      />
    </div>
  );
}
