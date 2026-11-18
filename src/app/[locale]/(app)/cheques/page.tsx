import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChequeTable, type ChequeItem } from "@/components/domain/cheque-table";
import { ListPagination } from "@/components/domain/list-pagination";
import { Card, CardBody, KpiLabel } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { PAGE_SIZE, getPaginationRange, toPaginated } from "@/lib/pagination";
import { formatMoney } from "@/lib/money";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";

type SearchParams = Promise<{
  status?: string;
  page?: string;
}>;

export default async function ChequesPage({
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

  const { status, page } = await searchParams;
  const t = await getTranslations("cheques");
  const tCommon = await getTranslations("common");
  const writable = ["org_admin", "manager", "accountant"].includes(ctx.role);

  const currentPage = Math.max(1, Number(page ?? 1));
  const { from, to } = getPaginationRange(currentPage, PAGE_SIZE);

  let aggregateQuery = ctx.supabase.from("cheques").select("amount_minor, status");
  let pageQuery = ctx.supabase
    .from("cheques")
    .select(
      `
      id,
      cheque_no,
      bank_name,
      amount_minor,
      currency,
      cheque_date,
      status,
      bounce_reason,
      tenants ( id, full_name ),
      leases ( id, lease_no )
    `,
      { count: "exact" },
    )
    .order("cheque_date", { ascending: true });

  if (status && status !== "all") {
    aggregateQuery = aggregateQuery.eq("status", status as never);
    pageQuery = pageQuery.eq("status", status as never);
  }

  const [{ data: allCheques }, { data: cheques, count }] = await Promise.all([
    aggregateQuery,
    pageQuery.range(from, to),
  ]);

  // KPI Calculations
  const aggregateRows = allCheques ?? [];
  const pendingAmountMinor = aggregateRows
    .filter((c) => c.status === "received" || c.status === "deposited")
    .reduce((acc, c) => acc + BigInt(c.amount_minor), 0n);

  const clearedAmountMinor = aggregateRows
    .filter((c) => c.status === "cleared")
    .reduce((acc, c) => acc + BigInt(c.amount_minor), 0n);

  const bouncedCount = aggregateRows.filter((c) => c.status === "bounced").length;

  const transformedCheques: ChequeItem[] = (cheques ?? []).map((c) => ({
    id: c.id,
    cheque_no: c.cheque_no,
    bank_name: c.bank_name,
    amount_minor: c.amount_minor,
    currency: c.currency,
    cheque_date: c.cheque_date,
    status: c.status as ChequeItem["status"],
    bounce_reason: c.bounce_reason,
    tenant: c.tenants as unknown as { id: string; full_name: string } | null,
    lease: c.leases as unknown as { id: string; lease_no: string } | null,
  }));

  const filterTabs = [
    { key: "all", label: tCommon("all") },
    { key: "received", label: t("statuses.received") },
    { key: "deposited", label: t("statuses.deposited") },
    { key: "cleared", label: t("statuses.cleared") },
    { key: "bounced", label: t("statuses.bounced") },
  ];

  const paged = toPaginated(transformedCheques, count, currentPage);

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="cheques"
        role={ctx.role}
        title={t("title")}
        description={t("subtitle")}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-fixed/40 text-primary">
              <Clock className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("kpis.pendingClearance")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(pendingAmountMinor, ctx.currency, locale)}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-secondary-container/60 text-secondary">
              <CheckCircle className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("kpis.clearedTotal")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(clearedAmountMinor, ctx.currency, locale)}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-error-container text-error">
              <AlertTriangle className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("kpis.bouncedCheques")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {bouncedCount}
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
              href={tab.key === "all" ? "/cheques" : `/cheques?status=${tab.key}`}
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

      <ChequeTable cheques={paged.rows} writable={writable} locale={locale} />

      <ListPagination
        page={paged.page}
        pages={paged.pages}
        total={paged.total}
        href="/cheques"
        params={{ status }}
      />
    </div>
  );
}
