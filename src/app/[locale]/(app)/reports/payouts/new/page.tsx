import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PayoutForm } from "@/components/domain/statement-generator";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

export default async function NewPayoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "statements.write")) return null;

  const t = await getTranslations("reports");
  const tc = await getTranslations("common");
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  const [{ data: rawOwners }, { data: rawBankAccounts }] = await Promise.all([
    ctx.supabase.from("owners").select("id, name").order("name"),
    ctx.supabase.from("bank_accounts").select("id, name").order("name"),
  ]);
  const owners = (rawOwners ?? []).map((o) => ({ id: o.id, name: o.name }));
  const bankAccounts = (rawBankAccounts ?? []).map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex items-center gap-3">
        <Link
          href="/reports"
          className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
        >
          <BackIcon className="h-4 w-4" />
          <span>{tc("back")}</span>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("recordPayout")}</CardTitle>
        </CardHeader>
        <CardBody>
          <PayoutForm owners={owners} bankAccounts={bankAccounts} />
        </CardBody>
      </Card>
    </div>
  );
}
