import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  Banknote,
  FileSignature,
  Clock,
  Receipt,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

export async function ReportsNavCards() {
  const t = await getTranslations("reports");

  const reportsList = [
    {
      href: "/reports/cash-flow-forecast",
      title: t("cashFlowForecast"),
      description: t("cashFlowForecastDesc"),
      icon: TrendingUp,
      color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    },
    {
      href: "/reports/occupancy",
      title: t("occupancy"),
      description: "Unit occupancy breakdown, vacant units, and vacancy loss analysis.",
      icon: Building2,
      color: "bg-primary-fixed/40 text-primary",
    },
    {
      href: "/reports/expiry",
      title: t("expiry"),
      description: "Lease expiration schedule, upcoming renewals, and timeline pipeline.",
      icon: CalendarDays,
      color: "bg-secondary-container/60 text-secondary",
    },
    {
      href: "/reports/collections",
      title: t("collections"),
      description: "Invoiced charges, collection performance, and realized revenue.",
      icon: CreditCard,
      color: "bg-tertiary-fixed/40 text-tertiary",
    },
    {
      href: "/reports/cheques",
      title: t("cheques"),
      description: "PDC clearing pipeline, deposited, cleared, and bounced cheque metrics.",
      icon: Banknote,
      color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    },
    {
      href: "/reports/rent-roll",
      title: t("rentRoll"),
      description: "Complete portfolio rent roll with tenant information, unit details, and lease terms.",
      icon: FileSignature,
      color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    },
    {
      href: "/reports/aged-receivables",
      title: t("agedReceivables"),
      description: "Overdue balances categorized across 30, 60, and 90+ day aging buckets.",
      icon: Clock,
      color: "bg-error-container text-error",
    },
    {
      href: "/reports/statements",
      title: t("statements"),
      description: "Owner distribution statements, net payable calculations, and management fee summaries.",
      icon: Receipt,
      color: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="size-5 text-primary" />
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Financial & Operational Reports</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportsList.map((rep) => {
          const Icon = rep.icon;
          return (
            <Link key={rep.href} href={rep.href} className="group">
              <Card className="h-full transition-all duration-200 group-hover:border-primary group-hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className={`flex size-10 items-center justify-center rounded-xl ${rep.color}`}>
                    <Icon className="size-5" />
                  </div>
                  <ArrowRight className="size-4 text-on-surface-variant transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                </CardHeader>
                <CardBody className="flex flex-col gap-1.5 pt-0">
                  <CardTitle className="font-headline-sm text-label-lg group-hover:text-primary">
                    {rep.title}
                  </CardTitle>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {rep.description}
                  </p>
                </CardBody>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

