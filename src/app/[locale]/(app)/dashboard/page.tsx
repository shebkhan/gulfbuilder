import { AlertTriangle, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getOrgContext } from "@/server/org-context";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const t = await getTranslations("dashboard");

  // Fetch expiring leases (next 30 days)
  const { data: rawExpiring } = await ctx.supabase.rpc("leases_expiring", {
    p_days: 30,
  });

  const expiringLeases = (rawExpiring ?? []) as {
    lease_id: string;
    lease_no: string;
    tenant_name: string;
    end_date: string;
    days_left: number;
  }[];

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-1">
        <span className="font-section-kicker text-section-kicker font-bold uppercase tracking-wider text-on-surface-variant">
          {t("orgCreated")}
        </span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <p className="max-w-xl font-body-md text-body-md text-on-surface-variant">{t("empty")}</p>
      </div>

      {expiringLeases && expiringLeases.length > 0 ? (
        <Card className="border-primary/20 bg-surface-container-lowest">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <CardTitle className="text-title-md">{t("expiringLeases")}</CardTitle>
            </div>
            <Link
              href="/leases?expiring=true"
              className="flex items-center gap-1 font-label-md text-label-md text-primary hover:underline underline-offset-4"
            >
              <span>{t("viewAll")}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardBody className="pt-0">
            <p className="mb-4 font-body-sm text-body-sm text-on-surface-variant">
              {t("expiringSubtitle")}
            </p>
            <div className="flex flex-col divide-y divide-hairline">
              {expiringLeases.map((lease) => (
                <div
                  key={lease.lease_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="flex flex-col">
                    <Link
                      href={`/leases/${lease.lease_id}`}
                      className="font-label-lg text-label-lg font-semibold text-on-surface hover:text-primary hover:underline underline-offset-4"
                    >
                      {lease.lease_no}
                    </Link>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      {lease.tenant_name} · Ends {lease.end_date}
                    </span>
                  </div>

                  <Badge variant={lease.days_left <= 7 ? "danger" : "warning"}>
                    {t("daysLeft", { days: lease.days_left })}
                  </Badge>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
