import { Building2, TrendingUp, DollarSign, AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardBody, KpiLabel } from "@/components/ui/card";
import { StatementGenerator } from "@/components/domain/statement-generator";
import { formatMoney } from "@/lib/money";
import { can, type Role } from "@/lib/rbac";
import type { PortfolioKpis } from "@/server/actions/reports";

type ReportsHeaderProps = {
  locale: string;
  role: Role;
  title: string;
  subtitle: string;
  kpis?: PortfolioKpis | null;
  ownerOptions?: { id: string; name: string }[];
  bankOptions?: { id: string; name: string }[];
  showStatementGenerator?: boolean;
};

export async function ReportsHeader({
  locale,
  role,
  title,
  subtitle,
  kpis,
  ownerOptions = [],
  bankOptions = [],
  showStatementGenerator = false,
}: ReportsHeaderProps) {
  const t = await getTranslations("reports");
  const writable = can(role, "statements.write");

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{title}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{subtitle}</p>
        </div>

        {showStatementGenerator && (
          <StatementGenerator owners={ownerOptions} bankAccounts={bankOptions} writable={writable} />
        )}
      </div>

      {kpis && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardBody className="flex items-center gap-4 p-5">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary-fixed/40 text-primary">
                <Building2 className="size-6" />
              </div>
              <div className="flex flex-col">
                <KpiLabel>{t("occupancyRate")}</KpiLabel>
                <span className="font-headline-md text-headline-md font-bold text-on-surface">
                  {kpis.occupancy_pct ?? 0}%
                </span>
                <span className="text-xs text-on-surface-variant">
                  {kpis.occupied_units ?? 0} of {kpis.total_units ?? 0} units
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
                <KpiLabel>{t("monthlyRentRoll")}</KpiLabel>
                <span className="font-headline-md text-headline-md font-bold text-on-surface">
                  {formatMoney(BigInt(kpis.monthly_rent_roll ?? 0), "QAR", locale)}
                </span>
                <span className="text-xs text-on-surface-variant">Active annualized pipeline</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex items-center gap-4 p-5">
              <div className="flex size-12 items-center justify-center rounded-xl bg-tertiary-fixed/40 text-tertiary">
                <DollarSign className="size-6" />
              </div>
              <div className="flex flex-col">
                <KpiLabel>{t("netOperatingIncome")}</KpiLabel>
                <span className="font-headline-md text-headline-md font-bold text-on-surface">
                  {formatMoney(BigInt(kpis.net_operating_income ?? 0), "QAR", locale)}
                </span>
                <span className="text-xs text-on-surface-variant">Collections less expenses</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex items-center gap-4 p-5">
              <div className="flex size-12 items-center justify-center rounded-xl bg-error-container text-error">
                <AlertTriangle className="size-6" />
              </div>
              <div className="flex flex-col">
                <KpiLabel>{t("overdueReceivables")}</KpiLabel>
                <span className="font-headline-md text-headline-md font-bold text-on-surface">
                  {formatMoney(BigInt(kpis.overdue_receivables ?? 0), "QAR", locale)}
                </span>
                <span className="text-xs text-on-surface-variant">Aged outstanding</span>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
