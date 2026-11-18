import { AlertTriangle } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import CashFlowChart from "@/components/domain/reports/cash-flow-chart";
import { PageHeader } from "@/components/domain/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/rbac";
import { formatMoney } from "@/lib/money";
import { getOrgContext } from "@/server/org-context";
import { getForecast } from "@/server/queries/forecast";

type SearchParams = Promise<{ months?: string; scenario?: string }>;

const HORIZONS = [3, 6, 12] as const;
const SCENARIOS = ["base", "conservative", "optimistic"] as const;

export default async function CashFlowForecastPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) notFound();
  if (!can(ctx.role, "reports.read")) notFound();

  const raw = await searchParams;
  const months = HORIZONS.includes(Number(raw.months) as (typeof HORIZONS)[number])
    ? Number(raw.months)
    : 3;
  const scenario = SCENARIOS.includes(raw.scenario as (typeof SCENARIOS)[number])
    ? (raw.scenario as (typeof SCENARIOS)[number])
    : "base";

  const t = await getTranslations("reports.cashFlowForecastPage");
  const forecast = await getForecast({ months, scenario });

  const href = (m: number, s: string) => `?months=${m}&scenario=${s}`;
  const chartData = forecast.net.map((item) => ({
    month: t("summary.monthLabel", { month: item.month }),
    net: item.amount_minor,
  }));

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="reports"
        role={ctx.role}
        title={t("title")}
        description={t("description")}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("controls.title")}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-2">
          {HORIZONS.map((m) => (
            <Button
              key={m}
              asChild
              variant={m === months ? "primary" : "secondary"}
              aria-current={m === months ? "true" : undefined}
            >
              <Link href={href(m, scenario)}>
                {m} {t("months")}
              </Link>
            </Button>
          ))}
          <span className="w-px bg-hairline" aria-hidden />
          {SCENARIOS.map((s) => (
            <Button
              key={s}
              asChild
              variant={s === scenario ? "primary" : "secondary"}
              aria-current={s === scenario ? "true" : undefined}
            >
              <Link href={href(months, s)}>{t(`scenarios.${s}`)}</Link>
            </Button>
          ))}
        </CardBody>
      </Card>

      {forecast.warnings.length > 0 ? (
        <Card className="border-primary-container bg-primary-container/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4" aria-hidden />
              {t("warnings.title")}
            </CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="list-disc space-y-1 ps-5">
              {forecast.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("chart.title")}</CardTitle>
        </CardHeader>
        <CardBody>
          <CashFlowChart
            data={chartData}
            currency={ctx.currency}
            locale={locale}
            netLabel={t("chart.net")}
            monthLabel={t("chart.month")}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("summary.title")}</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline">
                  <th scope="col" className="py-2 ps-2 text-start">
                    {t("summary.month")}
                  </th>
                  <th scope="col" className="py-2 pe-2 text-end">
                    {t("summary.inflow")}
                  </th>
                  <th scope="col" className="py-2 pe-2 text-end">
                    {t("summary.outflow")}
                  </th>
                  <th scope="col" className="py-2 pe-2 text-end">
                    {t("summary.net")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {forecast.net.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2 ps-2">
                      {t("summary.monthLabel", { month: item.month })}
                    </td>
                    <td className="py-2 pe-2 text-end">
                      {formatMoney(
                        BigInt(
                          Math.round(
                            (forecast.inflows[i]?.charges ?? 0) +
                              (forecast.inflows[i]?.cheques ?? 0),
                          ),
                        ),
                        ctx.currency,
                        locale,
                      )}
                    </td>
                    <td className="py-2 pe-2 text-end">
                      {formatMoney(
                        BigInt(
                          Math.round(
                            (forecast.outflows[i]?.expenses ?? 0) +
                              (forecast.outflows[i]?.payouts ?? 0),
                          ),
                        ),
                        ctx.currency,
                        locale,
                      )}
                    </td>
                    <td className="py-2 pe-2 text-end font-medium">
                      {formatMoney(BigInt(Math.round(item.amount_minor)), ctx.currency, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
