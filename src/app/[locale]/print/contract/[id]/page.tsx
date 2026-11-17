import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  PrintDocument,
  PrintLocaleLink,
  type PrintLine,
} from "@/components/domain/print-document";
import { formatMoney } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PrintContract({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("print");

  const supabase = await createSupabaseServerClient();
  const { data: lease } = await supabase
    .from("leases")
    .select("*, tenants(full_name), units(unit_no, buildings(name, code)), lease_terms(note, rent_minor, effective_from)")
    .eq("id", id)
    .maybeSingle();
  if (!lease) notFound();

  const { data: branding } = await supabase
    .from("org_branding")
    .select("app_name")
    .eq("org_id", lease.org_id)
    .maybeSingle();

  const tenant = lease.tenants as unknown as { full_name: string } | null;
  const unit = lease.units as unknown as {
    unit_no: string;
    buildings: { name: string; code: string } | null;
  } | null;
  const terms = (lease.lease_terms ?? []) as {
    note: string | null;
    rent_minor: number;
    effective_from: string;
  }[];
  const money = (amount: number) => formatMoney(BigInt(amount), lease.currency, locale);

  const lines: PrintLine[] = [
    { label: t("contract.landlord"), value: branding?.app_name ?? t("appName") },
    { label: t("tenant"), value: tenant?.full_name ?? "—" },
    { label: t("lease"), value: lease.lease_no },
    {
      label: t("unit"),
      value: [unit?.buildings?.name, unit?.unit_no].filter(Boolean).join(" / "),
    },
    { label: t("startDate"), value: lease.start_date },
    { label: t("endDate"), value: lease.end_date },
    { label: t("frequency"), value: lease.payment_frequency },
    { label: t("installments"), value: String(lease.installments) },
    { label: t("dueDay"), value: String(lease.due_day) },
    { label: t("noticeDays"), value: String(lease.notice_days) },
  ];
  if (lease.registration_no) {
    lines.push({ label: t("registration"), value: lease.registration_no });
  }
  for (const term of terms) {
    lines.push({
      label: t("term"),
      detail: term.effective_from,
      value: money(term.rent_minor),
    });
  }

  const otherLocale = locale === "ar" ? "en" : "ar";

  return (
    <div className="flex flex-col gap-4">
      <div className="print-no-print flex justify-end">
        <PrintLocaleLink href={`/print/contract/${id}`} locale={otherLocale} />
      </div>
      <PrintDocument
        title={t("contract.title")}
        orgName={branding?.app_name ?? t("appName")}
        lines={lines}
        totals={[
          { label: t("rent"), value: money(lease.rent_minor) },
          { label: t("deposit"), value: money(lease.deposit_minor), emphasis: true },
        ]}
        footer={terms.find((term) => term.note)?.note ?? t("footer")}
      />
    </div>
  );
}
