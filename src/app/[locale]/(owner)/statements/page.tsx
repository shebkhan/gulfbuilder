import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { getOwnerScope, getOwnerStatements } from "@/server/queries/owner-portal";

export default async function OwnerStatementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("owner.statements");
  const scope = await getOwnerScope();
  if (!scope) return null;

  const statements = await getOwnerStatements(scope);

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
          {statements.length === 0 ? (
            <p className="py-3 font-body-sm text-body-sm text-on-surface-variant">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-start font-body-sm text-body-sm">
                <thead>
                  <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                    <th className="p-3 text-start">{t("period")}</th>
                    <th className="p-3 text-start">{t("status")}</th>
                    <th className="p-3 text-end">{t("closing")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {statements.map((s) => (
                    <tr key={s.id}>
                      <td className="p-3">
                        <Link
                          href={`/owner/statements/${s.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {s.period_start} → {s.period_end}
                        </Link>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            s.status === "issued"
                              ? "success"
                              : s.status === "review"
                                ? "info"
                                : "neutral"
                          }
                        >
                          {s.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-end font-semibold text-on-surface">
                        {formatMoney(BigInt(s.closing_minor), s.currency, locale)}
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
