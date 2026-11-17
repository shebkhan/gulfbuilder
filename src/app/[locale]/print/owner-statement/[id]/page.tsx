import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  PrintDocument,
  PrintLocaleLink,
  type PrintLine,
} from "@/components/domain/print-document";
import { formatMoney } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PrintOwnerStatement({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("print");
  const ownerT = await getTranslations("owner.statements");

  const supabase = await createSupabaseServerClient();
  const { data: statement } = await supabase
    .from("owner_statements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!statement) notFound();

  const [{ data: owner }, { data: branding }] = await Promise.all([
    supabase.from("owners").select("name").eq("id", statement.owner_id).maybeSingle(),
    supabase.from("org_branding").select("app_name").eq("org_id", statement.org_id).maybeSingle(),
  ]);

  const money = (amount: number) => formatMoney(BigInt(amount), statement.currency, locale);
  const totals = (statement.totals ?? {}) as Record<string, number | string>;
  const lines = (statement.lines ?? []) as {
    kind?: string;
    description?: string;
    amount_minor?: number;
    date?: string;
  }[];

  const printLines: PrintLine[] = [
    { label: t("owner"), value: owner?.name ?? "—" },
    { label: t("period"), value: `${statement.period_start} → ${statement.period_end}` },
    { label: t("status"), value: statement.status },
  ];
  for (const line of lines) {
    printLines.push({
      label: line.kind ?? t("line"),
      detail: line.description ?? line.date,
      value: money(Number(line.amount_minor ?? 0)),
    });
  }

  const otherLocale = locale === "ar" ? "en" : "ar";

  return (
    <div className="flex flex-col gap-4">
      <div className="print-no-print flex justify-end">
        <PrintLocaleLink href={`/print/owner-statement/${id}`} locale={otherLocale} />
      </div>
      <PrintDocument
        title={t("ownerStatement.title")}
        orgName={branding?.app_name ?? t("appName")}
        lines={printLines}
        totals={[
          { label: ownerT("opening"), value: money(statement.opening_minor) },
          { label: ownerT("collections"), value: money(Number(totals.collections ?? 0)) },
          { label: ownerT("expenses"), value: money(Number(totals.expenses ?? 0)) },
          { label: ownerT("managementFee"), value: money(Number(totals.management_fee ?? 0)) },
          { label: ownerT("closing"), value: money(statement.closing_minor), emphasis: true },
        ]}
        footer={t("footer")}
      />
    </div>
  );
}
