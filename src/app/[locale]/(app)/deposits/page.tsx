import { MinusCircle, PiggyBank, RotateCcw } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DepositCard, type DepositItem } from "@/components/domain/deposit-card";
import { ListPagination } from "@/components/domain/list-pagination";
import { Card, CardBody, KpiLabel } from "@/components/ui/card";
import { paginate } from "@/lib/pagination";
import { formatMoney } from "@/lib/money";
import { getOrgContext } from "@/server/org-context";

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

  // Fetch deposits
  const { data: deposits } = await ctx.supabase
    .from("deposits")
    .select(`
      id,
      amount_minor,
      held_minor,
      deducted_minor,
      refunded_minor,
      currency,
      notes,
      tenants ( id, full_name ),
      leases ( id, lease_no )
    `)
    .order("created_at", { ascending: false });

  const allDeposits = deposits || [];

  const totalHeldMinor = allDeposits.reduce((acc, d) => acc + BigInt(d.held_minor), 0n);
  const totalDeductedMinor = allDeposits.reduce((acc, d) => acc + BigInt(d.deducted_minor), 0n);
  const totalRefundedMinor = allDeposits.reduce((acc, d) => acc + BigInt(d.refunded_minor), 0n);

  const transformedDeposits: DepositItem[] = allDeposits.map((d) => ({
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

  const paged = paginate(transformedDeposits, Number(page ?? 1));

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-fixed/40 text-primary">
              <PiggyBank className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>Total Held in Escrow</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(totalHeldMinor, "QAR", locale)}
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
              <KpiLabel>Deductions Applied</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(totalDeductedMinor, "QAR", locale)}
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
              <KpiLabel>Refunds Disbursed</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(totalRefundedMinor, "QAR", locale)}
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
