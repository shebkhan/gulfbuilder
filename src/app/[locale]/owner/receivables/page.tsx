import { getTranslations, setRequestLocale } from "next-intl/server";
import { DateCell } from "@/components/domain/date-cell";
import { ListPagination } from "@/components/domain/list-pagination";
import { Card, CardBody, CardHeader, CardTitle, KpiLabel } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { paginate } from "@/lib/pagination";
import { getOwnerReceivables, getOwnerScope } from "@/server/queries/owner-portal";

const BUCKETS = [
  { key: "0-30", min: 0, max: 30 },
  { key: "31-60", min: 31, max: 60 },
  { key: "61-90", min: 61, max: 90 },
  { key: "90+", min: 91, max: Number.MAX_SAFE_INTEGER },
] as const;

type SearchParams = Promise<{ page?: string }>;

export default async function OwnerReceivablesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { page } = await searchParams;
  const t = await getTranslations("owner.receivables");
  const scope = await getOwnerScope();
  if (!scope) return null;

  const rows = await getOwnerReceivables(scope);
  const totalMinor = rows.reduce((acc, r) => acc + BigInt(r.amount_minor), 0n);
  const paged = paginate(rows, Number(page ?? 1));

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {BUCKETS.map((bucket) => {
          const bucketTotal = rows
            .filter((r) => r.days_overdue >= bucket.min && r.days_overdue <= bucket.max)
            .reduce((acc, r) => acc + BigInt(r.amount_minor), 0n);
          return (
            <Card key={bucket.key}>
              <CardBody className="flex flex-col gap-1 p-5">
                <KpiLabel>{t(`buckets.${bucket.key}` as never)}</KpiLabel>
                <span className="font-headline-md text-headline-md font-bold text-on-surface">
                  {formatMoney(bucketTotal, scope.currency, locale)}
                </span>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            {t("total")}: {formatMoney(totalMinor, scope.currency, locale)}
          </CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {rows.length === 0 ? (
            <p className="py-3 font-body-sm text-body-sm text-on-surface-variant">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-start font-body-sm text-body-sm">
                <thead>
                  <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                    <th className="p-3 text-start">{t("tenant")}</th>
                    <th className="p-3 text-start">{t("building")}</th>
                    <th className="p-3 text-start">{t("dueDate")}</th>
                    <th className="p-3 text-end">{t("daysOverdue")}</th>
                    <th className="p-3 text-end">{t("amount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {paged.rows.map((r, i) => (
                    <tr key={`${r.tenant_name}-${r.due_date}-${i}`}>
                      <td className="p-3 font-medium text-on-surface">{r.tenant_name}</td>
                      <td className="p-3 text-on-surface-variant">{r.building_code ?? "—"}</td>
                      <td className="p-3 text-on-surface-variant">
                        <DateCell date={r.due_date} locale={locale} />
                      </td>
                      <td className="p-3 text-end text-on-surface-variant">{r.days_overdue}</td>
                      <td className="p-3 text-end font-semibold text-on-surface">
                        {formatMoney(BigInt(r.amount_minor), r.currency, locale)}
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
            href="/owner/receivables"
          />
        </CardBody>
      </Card>
    </div>
  );
}
