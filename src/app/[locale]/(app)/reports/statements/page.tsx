import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReportsHeader } from "@/components/domain/reports/reports-header";
import {
  StatementsTable,
  type RawStatementItem,
} from "@/components/domain/reports/statements-table";
import { getOrgContext } from "@/server/org-context";

export default async function StatementsReportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const t = await getTranslations("reports");

  const { data: rawStatements } = await ctx.supabase
    .from("owner_statements")
    .select(
      `
      id,
      period_start,
      period_end,
      currency,
      status,
      closing_minor,
      totals,
      owners ( id, name )
    `,
    )
    .order("period_start", { ascending: false });

  const labels = {
    emptyStatements: t("emptyStatements"),
    owner: t("owner"),
    period: t("period"),
    status: t("status"),
    collections: t("collections"),
    expenses: t("expenses"),
    managementFee: t("managementFee"),
    netPayable: t("netPayable"),
    issued: t("issued"),
  };

  const statements: RawStatementItem[] = (rawStatements || []).map((s) => ({
    id: s.id,
    period_start: s.period_start,
    period_end: s.period_end,
    currency: s.currency,
    status: s.status,
    closing_minor: s.closing_minor,
    totals: s.totals,
    owners: s.owners as unknown as { id: string; name: string } | null,
  }));

  return (
    <div className="flex flex-col gap-space-lg">
      <ReportsHeader
        locale={locale}
        role={ctx.role}
        title={t("statements")}
        subtitle={t("statementsSubtitle")}
        showStatementGenerator={true}
      />

      <StatementsTable statements={statements} locale={locale} labels={labels} />
    </div>
  );
}
