import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  PrintDocument,
  PrintLocaleLink,
  type PrintLine,
} from "@/components/domain/print-document";
import { formatMoney } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PrintStatement({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("print");
  const statementT = await getTranslations("portal.statement");

  const supabase = await createSupabaseServerClient();
  const { data: lease } = await supabase
    .from("leases")
    .select("*, tenants(full_name), units(unit_no, buildings(name))")
    .eq("id", id)
    .maybeSingle();
  if (!lease) notFound();

  const [{ data: charges }, { data: payments }, { data: credits }, { data: branding }] =
    await Promise.all([
      supabase.from("charges").select("*").eq("lease_id", id).order("due_date"),
      supabase.from("payments").select("*").eq("lease_id", id).order("received_at"),
      supabase
        .from("tenant_credits")
        .select("remaining_minor")
        .eq("tenant_id", lease.tenant_id),
      supabase.from("org_branding").select("app_name, logo_url").eq("org_id", lease.org_id).maybeSingle(),
    ]);

  const tenant = lease.tenants as unknown as { full_name: string } | null;
  const unit = lease.units as unknown as { unit_no: string; buildings: { name: string } | null } | null;
  const currency = charges?.[0]?.currency ?? lease.currency;
  const money = (amount: number | bigint) => formatMoney(BigInt(amount), currency, locale);
  const billed = (charges ?? []).reduce((sum, charge) => sum + BigInt(charge.amount_minor), 0n);
  const paid = (charges ?? []).reduce((sum, charge) => sum + BigInt(charge.paid_minor), 0n);
  const credit = (credits ?? []).reduce((sum, row) => sum + BigInt(row.remaining_minor), 0n);

  const lines: PrintLine[] = [
    { label: t("tenant"), value: tenant?.full_name ?? "—" },
    { label: t("lease"), value: lease.lease_no },
    {
      label: t("unit"),
      value: [unit?.buildings?.name, unit?.unit_no].filter(Boolean).join(" / "),
    },
    { label: t("period"), value: `${lease.start_date} → ${lease.end_date}` },
  ];
  for (const charge of charges ?? []) {
    lines.push({
      label: statementT(`types.${charge.type}` as never),
      detail: charge.due_date,
      value: money(charge.amount_minor),
    });
  }
  for (const payment of payments ?? []) {
    lines.push({
      label: statementT(`methods.${payment.method}` as never),
      detail: payment.received_at.slice(0, 10),
      value: money(payment.amount_minor),
    });
  }

  const otherLocale = locale === "ar" ? "en" : "ar";

  return (
    <div className="flex flex-col gap-4">
      <div className="print-no-print flex justify-end">
        <PrintLocaleLink href={`/print/statement/${id}`} locale={otherLocale} />
      </div>
      <PrintDocument
        title={t("statement.title")}
        orgName={branding?.app_name ?? t("appName")}
        logoUrl={branding?.logo_url ?? null}
        lines={lines}
        totals={[
          { label: t("billed"), value: money(billed) },
          { label: t("paid"), value: money(paid) },
          { label: t("credit"), value: money(credit) },
          { label: t("balance"), value: money(billed - paid), emphasis: true },
        ]}
        footer={t("footer")}
      />
    </div>
  );
}
