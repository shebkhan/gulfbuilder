import { getTranslations, setRequestLocale } from "next-intl/server";
import { ListPagination } from "@/components/domain/list-pagination";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { paginate } from "@/lib/pagination";
import { getOwnerPayouts, getOwnerScope } from "@/server/queries/owner-portal";

type SearchParams = Promise<{ page?: string }>;

export default async function OwnerPayoutsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { page } = await searchParams;
  const t = await getTranslations("owner.payouts");
  const scope = await getOwnerScope();
  if (!scope) return null;

  const payouts = await getOwnerPayouts(scope);
  const paged = paginate(payouts, Number(page ?? 1));

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
          {payouts.length === 0 ? (
            <p className="py-3 font-body-sm text-body-sm text-on-surface-variant">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-start font-body-sm text-body-sm">
                <thead>
                  <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                    <th className="p-3 text-start">{t("paidOn")}</th>
                    <th className="p-3 text-start">{t("method")}</th>
                    <th className="p-3 text-start">{t("reference")}</th>
                    <th className="p-3 text-end">{t("amount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {paged.rows.map((p) => (
                    <tr key={p.id}>
                      <td className="p-3 text-on-surface">{p.paid_on}</td>
                      <td className="p-3 text-on-surface-variant">{p.method}</td>
                      <td className="p-3 font-mono text-xs text-on-surface-variant">
                        {p.reference ?? "—"}
                      </td>
                      <td className="p-3 text-end font-semibold text-on-surface">
                        {formatMoney(BigInt(p.amount_minor), p.currency, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <ListPagination
            page={paged.page}
            pages={paged.pages}
            total={paged.total}
            href="/owner/payouts"
          />
        </CardBody>
      </Card>
    </div>
  );
}
