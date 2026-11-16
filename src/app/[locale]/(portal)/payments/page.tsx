import { getTranslations, setRequestLocale } from "next-intl/server";
import { PaymentProofForm } from "@/components/domain/payment-proof-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { getTenantPortalData } from "@/server/queries/tenant-portal";

export default async function PortalPaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("portal.payments");
  const data = await getTenantPortalData();
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("history")}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {data.payments.length === 0 ? (
            <p className="py-3 font-body-sm text-body-sm text-on-surface-variant">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {data.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex flex-col">
                    <span className="font-body-md text-body-md font-medium text-on-surface">
                      {t(`methods.${p.method}` as never)}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      {new Date(p.received_at).toLocaleDateString(locale)}
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
        </CardBody>
      </Card>

      <PaymentProofForm locale={locale} />
    </div>
  );
}
