import { Plus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DateCell } from "@/components/domain/date-cell";
import { ListPagination } from "@/components/domain/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { paginate } from "@/lib/pagination";
import { getTenantPortalData } from "@/server/queries/tenant-portal";
import { EmptyState } from "@/components/domain/empty-state";

type SearchParams = Promise<{ page?: string }>;

export default async function PortalPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { page } = await searchParams;
  const t = await getTranslations("portal.payments");
  const data = await getTenantPortalData();
  if (!data) return null;

  const paged = paginate(data.payments, Number(page ?? 1));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/portal/payments/upload">
            <Plus aria-hidden />
            {t("uploadTitle")}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("history")}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {data.payments.length === 0 ? (
            <EmptyState animation="/animations/empty-box.lottie" description={t("empty")} />
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {paged.rows.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex flex-col">
                    <span className="font-body-md text-body-md font-medium text-on-surface">
                      {t(`methods.${p.method}` as never)}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      <DateCell date={p.received_at} locale={locale} />
                      {p.reference ? ` · ${p.reference}` : ""}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold text-on-surface">
                      {formatMoney(BigInt(p.amount_minor), p.currency, locale)}
                    </span>
                    {p.status === "pending_confirmation" ? (
                      <Badge variant="warning">{t("pending")}</Badge>
                    ) : (
                      <Badge variant="success">{t("confirmed")}</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <ListPagination
            page={paged.page}
            pages={paged.pages}
            total={paged.total}
            href="/portal/payments"
          />
        </CardBody>
      </Card>
    </div>
  );
}
