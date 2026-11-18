import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  PrintDocument,
  PrintLocaleLink,
  type PrintLine,
} from "@/components/domain/print-document";
import { formatMoney } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PrintReceipt({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("print");
  const statement = await getTranslations("portal.statement");

  const supabase = await createSupabaseServerClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("*, tenants(full_name), leases(lease_no)")
    .eq("id", id)
    .maybeSingle();
  if (!payment) notFound();

  const { data: allocations } = await supabase
    .from("payment_allocations")
    .select("amount_minor, charges(type, due_date)")
    .eq("payment_id", id);
  const { data: branding } = await supabase
    .from("org_branding")
    .select("app_name, logo_url")
    .eq("org_id", payment.org_id)
    .maybeSingle();

  const tenant = payment.tenants as unknown as { full_name: string } | null;
  const lease = payment.leases as unknown as { lease_no: string } | null;
  const money = (amount: number) => formatMoney(BigInt(amount), payment.currency, locale);

  const lines: PrintLine[] = [
    {
      label: t("receiptNo"),
      value:
        payment.receipt_year && payment.receipt_no
          ? `${payment.receipt_year}/${payment.receipt_no}`
          : t("pendingReceipt"),
    },
    { label: t("tenant"), value: tenant?.full_name ?? "—" },
    { label: t("lease"), value: lease?.lease_no ?? "—" },
    { label: t("method"), value: statement(`methods.${payment.method}` as never) },
    { label: t("date"), value: payment.received_at.slice(0, 10) },
  ];
  if (payment.reference) lines.push({ label: t("reference"), value: payment.reference });
  for (const allocation of allocations ?? []) {
    const charge = allocation.charges as unknown as { type: string; due_date: string } | null;
    lines.push({
      label: charge ? statement(`types.${charge.type}` as never) : t("allocation"),
      detail: charge?.due_date,
      value: money(allocation.amount_minor),
    });
  }
  if (payment.notes) lines.push({ label: t("note"), value: payment.notes });

  const otherLocale = locale === "ar" ? "en" : "ar";

  return (
    <div className="flex flex-col gap-4">
      <div className="print-no-print flex justify-end">
        <PrintLocaleLink href={`/print/receipt/${id}`} locale={otherLocale} />
      </div>
      <PrintDocument
        title={t("receipt.title")}
        orgName={branding?.app_name ?? t("appName")}
        logoUrl={branding?.logo_url ?? null}
        lines={lines}
        totals={[{ label: t("amount"), value: money(payment.amount_minor), emphasis: true }]}
        footer={t("footer")}
      />
    </div>
  );
}
