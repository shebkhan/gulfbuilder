import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExpenseForm } from "@/components/domain/expense-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

export default async function NewExpensePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "expenses.write")) return null;

  const t = await getTranslations("expenses");
  const tc = await getTranslations("common");
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  const [{ data: rawVendors }, { data: rawBuildings }] = await Promise.all([
    ctx.supabase.from("vendors").select("id, name").order("name"),
    ctx.supabase
      .from("buildings")
      .select("id, name, code")
      .is("deleted_at", null)
      .order("code"),
  ]);

  const vendors = (rawVendors ?? []).map((v) => ({ id: v.id, name: v.name }));
  const buildings = (rawBuildings ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
  }));

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex items-center gap-3">
        <Link
          href="/expenses"
          className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
        >
          <BackIcon className="h-4 w-4" />
          <span>{tc("back")}</span>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("createExpense")}</CardTitle>
        </CardHeader>
        <CardBody>
          <ExpenseForm vendors={vendors} buildings={buildings} currency={ctx.currency} />
        </CardBody>
      </Card>
    </div>
  );
}
