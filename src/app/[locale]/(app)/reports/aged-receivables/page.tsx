import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReportsHeader } from "@/components/domain/reports/reports-header";
import { AgedReceivablesTable } from "@/components/domain/reports/aged-receivables-table";
import { fetchAgedReceivables } from "@/server/actions/reports";
import { getOrgContext } from "@/server/org-context";

export default async function AgedReceivablesReportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const t = await getTranslations("reports");
  const agedReceivables = await fetchAgedReceivables();

  const labels = {
    emptyReceivables: t("emptyReceivables"),
    tenant: t("tenant"),
    lease: t("lease"),
    overdueDays: t("overdueDays"),
    bucket: t("bucket"),
    amount: t("amount"),
  };

  return (
    <div className="flex flex-col gap-space-lg">
      <ReportsHeader
        locale={locale}
        role={ctx.role}
        title={t("agedReceivables")}
        subtitle="Aged receivables report categorized by days overdue across tenant leases."
      />

      <AgedReceivablesTable
        agedReceivables={agedReceivables}
        locale={locale}
        labels={labels}
      />
    </div>
  );
}
