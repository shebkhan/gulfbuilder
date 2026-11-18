import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DepositRefundForm, type DepositItem } from "@/components/domain/deposit-card";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getOrgContext } from "@/server/org-context";

export default async function RefundDepositPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx || !["org_admin", "manager"].includes(ctx.role)) return null;

  const t = await getTranslations("deposits");
  const tc = await getTranslations("common");
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  const { data: row } = await ctx.supabase
    .from("deposits")
    .select(`
      id,
      amount_minor,
      held_minor,
      deducted_minor,
      refunded_minor,
      currency,
      notes,
      tenants ( id, full_name ),
      leases ( id, lease_no )
    `)
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();

  const deposit: DepositItem = {
    id: row.id,
    amount_minor: row.amount_minor,
    held_minor: row.held_minor,
    deducted_minor: row.deducted_minor,
    refunded_minor: row.refunded_minor,
    currency: row.currency,
    notes: row.notes,
    tenant: row.tenants as unknown as { id: string; full_name: string } | null,
    lease: row.leases as unknown as { id: string; lease_no: string } | null,
  };
  const balance = deposit.held_minor - deposit.deducted_minor - deposit.refunded_minor;

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex items-center gap-3">
        <Link
          href="/deposits"
          className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
        >
          <BackIcon className="h-4 w-4" />
          <span>{tc("back")}</span>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("refund")}</CardTitle>
        </CardHeader>
        <CardBody>
          <DepositRefundForm deposit={deposit} balance={balance} currency={ctx.currency} />
        </CardBody>
      </Card>
    </div>
  );
}
