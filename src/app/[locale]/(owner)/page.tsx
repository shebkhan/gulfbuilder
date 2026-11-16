import { AlertTriangle, Banknote, Building2, CalendarClock, TrendingUp, Wrench } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle, KpiLabel } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { getOwnerDashboard, getOwnerScope } from "@/server/queries/owner-portal";

export default async function OwnerHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("owner");
  const scope = await getOwnerScope();
  if (!scope) return null;

  const dashboard = await getOwnerDashboard(scope);
  const occupancyPct =
    dashboard.totalUnits > 0
      ? Math.round((dashboard.occupiedUnits / dashboard.totalUnits) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-fixed/40 text-primary">
              <Building2 className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("occupancy")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {occupancyPct}%
              </span>
              <span className="text-xs text-on-surface-variant">
                {dashboard.occupiedUnits} / {dashboard.totalUnits} {t("units")}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-secondary-container/60 text-secondary">
              <TrendingUp className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("collectedVsExpected")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(dashboard.collectedThisMonth, scope.currency, locale)}
              </span>
              <span className="text-xs text-on-surface-variant">
                {t("expected")}: {formatMoney(dashboard.expectedThisMonth, scope.currency, locale)}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-error-container text-error">
              <AlertTriangle className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("arrears")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(dashboard.arrears, scope.currency, locale)}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-tertiary-fixed/40 text-tertiary">
              <Banknote className="size-6" />
            </div>
            <div className="flex flex-col">
              <KpiLabel>{t("noi")}</KpiLabel>
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {formatMoney(dashboard.noiYearToDate, scope.currency, locale)}
              </span>
              <span className="text-xs text-on-surface-variant">{t("noiYearToDate")}</span>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />
              <CardTitle>{t("upcomingCheques")}</CardTitle>
            </div>
            <Link
              href="/owner/receivables"
              className="font-label-md text-label-md text-primary hover:underline underline-offset-4"
            >
              {t("viewAll")}
            </Link>
          </CardHeader>
          <CardBody className="pt-0">
            {dashboard.upcomingCheques.length === 0 ? (
              <p className="py-3 font-body-sm text-body-sm text-on-surface-variant">
                {t("noCheques")}
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-hairline">
                {dashboard.upcomingCheques.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-on-surface">
                        {t("cheque")} #{c.cheque_no}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {c.bank_name ?? "—"} · {c.cheque_date}
                      </span>
                    </div>
                    <span className="font-semibold text-on-surface">
                      {formatMoney(BigInt(c.amount_minor), c.currency, locale)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-secondary" />
              <CardTitle>{t("expiringLeases")}</CardTitle>
            </div>
            <Link
              href="/owner/rent-roll"
              className="font-label-md text-label-md text-primary hover:underline underline-offset-4"
            >
              {t("viewAll")}
            </Link>
          </CardHeader>
          <CardBody className="pt-0">
            {dashboard.expiringLeases.length === 0 ? (
              <p className="py-3 font-body-sm text-body-sm text-on-surface-variant">
                {t("noExpiring")}
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-hairline">
                {dashboard.expiringLeases.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-on-surface">{l.lease_no}</span>
                      <span className="text-xs text-on-surface-variant">{l.tenant_name}</span>
                    </div>
                    <Badge variant="warning">{l.end_date}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-error" />
              <CardTitle>{t("openMaintenance")}</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <span className="font-headline-md text-headline-md font-bold text-on-surface">
              {dashboard.openMaintenance}
            </span>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-tertiary" />
              <CardTitle>{t("balance")}</CardTitle>
            </div>
            <Link
              href="/owner/statements"
              className="font-label-md text-label-md text-primary hover:underline underline-offset-4"
            >
              {t("viewAll")}
            </Link>
          </CardHeader>
          <CardBody className="flex flex-col gap-1 pt-0">
            <span className="font-headline-md text-headline-md font-bold text-on-surface">
              {formatMoney(dashboard.closingBalance, scope.currency, locale)}
            </span>
            <span className="text-xs text-on-surface-variant">{t("balanceHint")}</span>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
