import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReportsHeader } from "@/components/domain/reports/reports-header";
import { RentRollTable } from "@/components/domain/reports/rent-roll-table";
import { fetchRentRoll } from "@/server/actions/reports";
import { getOrgContext } from "@/server/org-context";

export default async function RentRollReportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const t = await getTranslations("reports");
  const rentRoll = await fetchRentRoll();

  const labels = {
    emptyRentRoll: t("emptyRentRoll"),
    property: t("property"),
    unit: t("unit"),
    tenant: t("tenant"),
    lease: t("lease"),
    dates: t("dates"),
    status: t("status"),
    rent: t("rent"),
  };

  return (
    <div className="flex flex-col gap-space-lg">
      <ReportsHeader
        locale={locale}
        role={ctx.role}
        title={t("rentRoll")}
        subtitle="Complete tenant rent roll detailing building, unit, active lease terms, and monthly rental amounts."
      />

      <RentRollTable rentRoll={rentRoll} locale={locale} labels={labels} />
    </div>
  );
}
