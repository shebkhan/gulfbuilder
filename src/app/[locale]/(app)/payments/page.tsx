import { CreditCard, Receipt, TrendingUp } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DateCell } from "@/components/domain/date-cell";
import { ListPagination } from "@/components/domain/list-pagination";
import { PaymentForm } from "@/components/domain/payment-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, KpiLabel } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { paginate } from "@/lib/pagination";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";

type SearchParams = Promise<{ page?: string }>;

export default async function PaymentsPage({
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
  const t = await getTranslations("payments");
  const writable = can(ctx.role, "finance.write") || ctx.role === "manager";

  // Fetch payments
  const { data: payments } = await ctx.supabase
    .from("payments")
    .select(`
      id,
      receipt_no,
      receipt_year,
      amount_minor,
      currency,
      method,
      received_at,
      reference,
      notes,
      tenants ( id, full_name ),
      leases ( id, lease_no )
    `)
    .order("receipt_year", { ascending: false })
    .order("receipt_no", { ascending: false });

  // Fetch buildings & leases for modal form (tenants load on demand per building)
  const { data: rawBuildings } = await ctx.supabase
    .from("buildings")
    .select("id, code, name")
    .order("code");

  const { data: rawLeases } = await ctx.supabase
    .from("leases")
    .select("id, lease_no, tenant_id")
    .in("status", ["active", "draft"])
    .order("lease_no");

  const buildingOptions = (rawBuildings || []).map((b) => ({ id: b.id, code: b.code, name: b.name }));
  const leaseOptions = (rawLeases || []).map((l) => ({
    id: l.id,
    lease_no: l.lease_no,
    tenant_id: l.tenant_id,
  }));

  // KPI aggregates
  const totalReceivedMinor = (payments || []).reduce(
    (acc, p) => acc + BigInt(p.amount_minor),
    0n,
  );
  const paymentCount = payments?.length || 0;

  const paged = paginate(payments ?? [], Number(page ?? 1));

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="payments"
        role={ctx.role}
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-3">

        {writable && (
          <PaymentForm
            buildings={buildingOptions}
            leases={leaseOptions}
            locale={locale}
          />
        )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-fixed/40 text-primary">
              <TrendingUp className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("kpis.totalCollections")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(totalReceivedMinor, "QAR", locale)}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-secondary-container/60 text-secondary">
              <Receipt className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("kpis.receiptsIssued")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {paymentCount}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-tertiary-fixed/40 text-tertiary">
              <CreditCard className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("kpis.defaultCurrency")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                QAR
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Payments List */}
      <div className="overflow-hidden rounded-xl border border-hairline bg-surface-container-lowest shadow-card">
        {(!payments || payments.length === 0) ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Receipt className="size-12 text-on-surface-variant/40" />
            <p className="font-body-md text-body-md text-on-surface-variant">{t("empty")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-start font-body-sm text-body-sm">
              <thead>
                <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                  <th className="p-4 text-start">{t("receiptNo")}</th>
                  <th className="p-4 text-start">{t("tenant")}</th>
                  <th className="p-4 text-start">{t("lease")}</th>
                  <th className="p-4 text-start">{t("method")}</th>
                  <th className="p-4 text-start">{t("reference")}</th>
                  <th className="p-4 text-start">{t("date")}</th>
                  <th className="p-4 text-end">{t("amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {paged.rows.map((p) => {
                  const tenant = p.tenants as unknown as { id: string; full_name: string } | null;
                  const lease = p.leases as unknown as { id: string; lease_no: string } | null;
                  const receiptFormatted = `#${p.receipt_year}-${String(p.receipt_no).padStart(4, "0")}`;

                  return (
                    <tr key={p.id} className="transition-colors hover:bg-surface-container-low/50">
                      <td className="p-4 font-mono font-semibold text-primary">
                        {receiptFormatted}
                      </td>
                      <td className="p-4 font-medium text-on-surface">
                        {tenant ? (
                          <Link
                            href={`/tenants/${tenant.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {tenant.full_name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-4 text-on-surface-variant">
                        {lease ? (
                          <Link
                            href={`/leases/${lease.id}`}
                            className="font-mono hover:text-primary hover:underline"
                          >
                            {lease.lease_no}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-4">
                        <Badge variant="neutral">
                          {t(`methods.${p.method}` as never)}
                        </Badge>
                      </td>
                      <td className="p-4 font-mono text-xs text-on-surface-variant">
                        {p.reference || "—"}
                      </td>
                      <td className="p-4 text-on-surface-variant">
                        <DateCell date={p.received_at} locale={locale} />
                      </td>
                      <td className="p-4 text-end font-semibold text-on-surface">
                        {formatMoney(BigInt(p.amount_minor), p.currency, locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ListPagination
        page={paged.page}
        pages={paged.pages}
        total={paged.total}
        href="/payments"
      />
    </div>
  );
}
