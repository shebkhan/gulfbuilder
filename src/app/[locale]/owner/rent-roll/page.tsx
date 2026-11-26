import { getTranslations, setRequestLocale } from "next-intl/server";
import { DateCell, DaysLeft } from "@/components/domain/date-cell";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { getOwnerRentRoll, getOwnerScope } from "@/server/queries/owner-portal";
import { EmptyState } from "@/components/domain/empty-state";

export default async function OwnerRentRollPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("owner.rentRoll");
  const tc = await getTranslations("common");
  const scope = await getOwnerScope();
  if (!scope) return null;

  const rows = await getOwnerRentRoll(scope);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("list")}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {rows.length === 0 ? (
            <EmptyState animation="/animations/empty-box.lottie" description={t("empty")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-start font-body-sm text-body-sm">
                <thead>
                  <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                    <th className="p-3 text-start">{t("unit")}</th>
                    <th className="p-3 text-start">{t("tenant")}</th>
                    <th className="p-3 text-start">{t("period")}</th>
                    <th className="p-3 text-start">{tc("daysLeftHeader")}</th>
                    <th className="p-3 text-end">{t("rent")}</th>
                    <th className="p-3 text-end">{t("deposit")}</th>
                    <th className="p-3 text-end">{t("paidToDate")}</th>
                    <th className="p-3 text-start">{t("status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="p-3 font-medium text-on-surface">
                        {r.building_code ? `${r.building_code} · ` : ""}
                        {r.unit_no ?? r.lease_no}
                      </td>
                      <td className="p-3 text-on-surface">{r.tenant_name}</td>
                      <td className="p-3 text-on-surface-variant">
                        <DateCell date={r.start_date} locale={locale} /> →{" "}
                        <DateCell date={r.end_date} locale={locale} />
                      </td>
                      <td className="p-3 text-on-surface-variant">
                        <DaysLeft date={r.end_date} />
                      </td>
                      <td className="p-3 text-end text-on-surface">
                        {formatMoney(BigInt(r.rent_minor), r.currency, locale)}
                      </td>
                      <td className="p-3 text-end text-on-surface-variant">
                        {formatMoney(BigInt(r.deposit_minor), r.currency, locale)}
                      </td>
                      <td className="p-3 text-end text-on-surface-variant">
                        {formatMoney(BigInt(r.paid_minor), r.currency, locale)}
                      </td>
                      <td className="p-3">
                        <Badge variant={r.status === "active" ? "success" : "neutral"}>
                          {r.status}
                        </Badge>
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
