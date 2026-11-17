import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  defaultReportFilters,
  fetchPortfolioKpis,
  fetchRentRoll,
  fetchAgedReceivables,
} from "@/server/actions/reports";
import { getOrgContext } from "@/server/org-context";
import { ReportsHeader } from "@/components/domain/reports/reports-header";
import { QuickOverviewCards } from "@/components/domain/reports/quick-overview-cards";
import { ReportsNavCards } from "@/components/domain/reports/reports-nav-cards";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  building?: string;
}>;

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const { from, to, building } = await searchParams;
  defaultReportFilters({ from, to, building });
  const t = await getTranslations("reports");

  const [kpis, rentRoll, agedReceivables, { data: rawOwners }, { data: rawBankAccounts }] =
    await Promise.all([
      fetchPortfolioKpis(),
      fetchRentRoll(),
      fetchAgedReceivables(),
      ctx.supabase.from("owners").select("id, name").order("name"),
      ctx.supabase.from("bank_accounts").select("id, name").order("name"),
    ]);

  const ownerOptions = (rawOwners || []).map((o) => ({ id: o.id, name: o.name }));
  const bankOptions = (rawBankAccounts || []).map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="flex flex-col gap-space-lg">
      <ReportsHeader
        locale={locale}
        role={ctx.role}
        title={t("title")}
        subtitle={t("subtitle")}
        kpis={kpis}
        ownerOptions={ownerOptions}
        bankOptions={bankOptions}
        showStatementGenerator={true}
      />

      <ReportsNavCards />

      <QuickOverviewCards
        rentRoll={rentRoll}
        agedReceivables={agedReceivables}
        locale={locale}
      />
    </div>
  );
}
