import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChequeReplaceForm, type ChequeItem } from "@/components/domain/cheque-table";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getOrgContext } from "@/server/org-context";

export default async function ReplaceChequePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx || !["org_admin", "manager", "accountant"].includes(ctx.role)) return null;

  const t = await getTranslations("cheques");
  const tc = await getTranslations("common");
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  const { data: row } = await ctx.supabase
    .from("cheques")
    .select(`
      id,
      cheque_no,
      bank_name,
      amount_minor,
      currency,
      cheque_date,
      status,
      bounce_reason,
      tenants ( id, full_name ),
      leases ( id, lease_no )
    `)
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();

  const cheque: ChequeItem = {
    id: row.id,
    cheque_no: row.cheque_no,
    bank_name: row.bank_name,
    amount_minor: row.amount_minor,
    currency: row.currency,
    cheque_date: row.cheque_date,
    status: row.status as ChequeItem["status"],
    bounce_reason: row.bounce_reason,
    tenant: row.tenants as unknown as { id: string; full_name: string } | null,
    lease: row.leases as unknown as { id: string; lease_no: string } | null,
  };

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex items-center gap-3">
        <Link
          href="/cheques"
          className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
        >
          <BackIcon className="h-4 w-4" />
          <span>{tc("back")}</span>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("replaceTitle", { no: cheque.cheque_no })}</CardTitle>
        </CardHeader>
        <CardBody>
          <ChequeReplaceForm cheque={cheque} />
        </CardBody>
      </Card>
    </div>
  );
}
