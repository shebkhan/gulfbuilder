import { getTranslations, setRequestLocale } from "next-intl/server";
import { DateCell, DaysLeft } from "@/components/domain/date-cell";
import { ListPagination } from "@/components/domain/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { paginate } from "@/lib/pagination";
import { getTenantPortalData } from "@/server/queries/tenant-portal";
import { EmptyState } from "@/components/domain/empty-state";

type SearchParams = Promise<{ page?: string }>;

export default async function PortalStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { page } = await searchParams;
  const t = await getTranslations("portal.statement");
  const tc = await getTranslations("common");
  const data = await getTenantPortalData();
  if (!data) return null;

  const charges = data.charges;
  const payments = data.payments;
  const billedMinor = charges.reduce((acc, c) => acc + BigInt(c.amount_minor), 0n);
  const paidMinor = charges.reduce((acc, c) => acc + BigInt(c.paid_minor), 0n);
  const creditMinor = data.credits.reduce((acc, c) => acc + BigInt(c.remaining_minor), 0n);
  const currency = charges[0]?.currency ?? "QAR";
  const pagedCharges = paginate(charges, Number(page ?? 1));
  const pagedPayments = paginate(payments, Number(page ?? 1));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>

      <Card>
        <CardBody className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <span className="font-body-md text-body-md text-on-surface-variant">{t("billed")}</span>
            <span className="font-semibold text-on-surface">
              {formatMoney(billedMinor, currency, locale)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-body-md text-body-md text-on-surface-variant">{t("paid")}</span>
            <span className="font-semibold text-on-surface">
              {formatMoney(paidMinor, currency, locale)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-body-md text-body-md text-on-surface-variant">{t("balance")}</span>
            <span className="font-semibold text-error">
              {formatMoney(billedMinor - paidMinor, currency, locale)}
            </span>
          </div>
          {creditMinor > 0n && (
            <div className="flex items-center justify-between">
              <span className="font-body-md text-body-md text-on-surface-variant">
                {t("credit")}
              </span>
              <span className="font-semibold text-secondary">
                {formatMoney(creditMinor, currency, locale)}
              </span>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("charges")}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {charges.length === 0 ? (
            <EmptyState animation="/animations/empty-box.lottie" description={t("empty")} />
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {pagedCharges.rows.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex flex-col">
                    <span className="font-body-md text-body-md font-medium text-on-surface">
                      {t(`types.${c.type}` as never)}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      {t("dueOn")}: <DateCell date={c.due_date} locale={locale} /> ·{" "}
                      {tc("daysLeftHeader")}: <DaysLeft date={c.due_date} />
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold text-on-surface">
                      {formatMoney(BigInt(c.amount_minor), c.currency, locale)}
                    </span>
                    <Badge
                      variant={
                        c.status === "paid"
                          ? "success"
                          : c.status === "overdue"
                            ? "danger"
                            : c.status === "partial"
                              ? "warning"
                              : "neutral"
                      }
                    >
                      {t(`status.${c.status}` as never)}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <ListPagination
            page={pagedCharges.page}
            pages={pagedCharges.pages}
            total={pagedCharges.total}
            href="/portal/statement"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("payments")}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {payments.length === 0 ? (
            <EmptyState animation="/animations/empty-box.lottie" description={t("empty")} />
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {pagedPayments.rows.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex flex-col">
                    <span className="font-body-md text-body-md font-medium text-on-surface">
                      {t(`methods.${p.method}` as never)}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      <DateCell date={p.received_at} locale={locale} />
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold text-on-surface">
                      {formatMoney(BigInt(p.amount_minor), p.currency, locale)}
                    </span>
                    {p.status === "pending_confirmation" && (
                      <Badge variant="warning">{t("pending")}</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <ListPagination
            page={pagedPayments.page}
            pages={pagedPayments.pages}
            total={pagedPayments.total}
            href="/portal/statement"
          />
        </CardBody>
      </Card>
    </div>
  );
}
