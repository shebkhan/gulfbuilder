import { CalendarClock, Home, Receipt, Wallet, Wrench } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle, KpiLabel } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { getTenantPortalData } from "@/server/queries/tenant-portal";

export default async function PortalHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("portal");
  const data = await getTenantPortalData();
  if (!data) return null;

  const activeLease = data.leases.find((l) => l.status === "active") ?? data.leases[0] ?? null;
  const openCharges = data.charges.filter(
    (c) => c.status === "pending" || c.status === "partial" || c.status === "overdue",
  );
  const outstandingMinor = openCharges.reduce(
    (acc, c) => acc + BigInt(c.amount_minor - c.paid_minor),
    0n,
  );
  const currency = activeLease?.currency ?? "QAR";
  const nextCharge = [...openCharges].sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const openRequests = data.requests.filter(
    (r) => r.status === "open" || r.status === "assigned" || r.status === "in_progress",
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          {data.tenant ? t("greeting", { name: data.tenant.full_name }) : t("title")}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardBody className="flex flex-col gap-1 p-4">
            <KpiLabel>{t("outstanding")}</KpiLabel>
            <span className="font-headline-md text-headline-md font-bold text-on-surface">
              {formatMoney(outstandingMinor, currency, locale)}
            </span>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-col gap-1 p-4">
            <KpiLabel>{t("openRequests")}</KpiLabel>
            <span className="font-headline-md text-headline-md font-bold text-on-surface">
              {openRequests.length}
            </span>
          </CardBody>
        </Card>
      </div>

      {activeLease ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Home className="size-5 text-primary" />
              <CardTitle>{t("myLease")}</CardTitle>
            </div>
            <Badge variant={activeLease.status === "active" ? "success" : "neutral"}>
              {t(`leaseStatus.${activeLease.status}` as never)}
            </Badge>
          </CardHeader>
          <CardBody className="flex flex-col gap-2 pt-0">
            <p className="font-body-md text-body-md font-medium text-on-surface">
              {[activeLease.building_code, activeLease.unit_no ?? activeLease.room_no]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {t("rent")}: {formatMoney(BigInt(activeLease.rent_minor), activeLease.currency, locale)} ·{" "}
              {t("period")}: {activeLease.start_date} → {activeLease.end_date}
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-4">
            <p className="font-body-md text-body-md text-on-surface-variant">{t("noLease")}</p>
          </CardBody>
        </Card>
      )}

      {nextCharge && (
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-5 text-secondary" />
              <CardTitle>{t("nextDue")}</CardTitle>
            </div>
            <Badge variant={nextCharge.status === "overdue" ? "danger" : "warning"}>
              {t(`chargeStatus.${nextCharge.status}` as never)}
            </Badge>
          </CardHeader>
          <CardBody className="flex flex-col gap-1 pt-0">
            <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              {formatMoney(
                BigInt(nextCharge.amount_minor - nextCharge.paid_minor),
                nextCharge.currency,
                locale,
              )}
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              {t("dueOn")}: {nextCharge.due_date}
            </span>
          </CardBody>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <Link
          href="/portal/statement"
          className="flex items-center justify-between rounded-xl border border-hairline bg-surface-container-lowest px-4 py-3"
        >
          <span className="flex items-center gap-2 font-body-md text-body-md font-medium text-on-surface">
            <Receipt className="size-5 text-primary" />
            {t("statement")}
          </span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {t("statementHint")}
          </span>
        </Link>
        <Link
          href="/portal/payments"
          className="flex items-center justify-between rounded-xl border border-hairline bg-surface-container-lowest px-4 py-3"
        >
          <span className="flex items-center gap-2 font-body-md text-body-md font-medium text-on-surface">
            <Wallet className="size-5 text-secondary" />
            {t("payments")}
          </span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {t("paymentsHint")}
          </span>
        </Link>
        <Link
          href="/portal/requests"
          className="flex items-center justify-between rounded-xl border border-hairline bg-surface-container-lowest px-4 py-3"
        >
          <span className="flex items-center gap-2 font-body-md text-body-md font-medium text-on-surface">
            <Wrench className="size-5 text-tertiary" />
            {t("requests")}
          </span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {t("requestsHint")}
          </span>
        </Link>
      </div>
    </div>
  );
}
