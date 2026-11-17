import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChequeBounceForm } from "@/components/domain/cheque-table";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getOrgContext } from "@/server/org-context";

export default async function BounceChequePage({
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

  const { data: cheque } = await ctx.supabase
    .from("cheques")
    .select("id, cheque_no")
    .eq("id", id)
    .maybeSingle();
  if (!cheque) notFound();

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
          <CardTitle>{t("bounceTitle", { no: cheque.cheque_no })}</CardTitle>
        </CardHeader>
        <CardBody>
          <ChequeBounceForm chequeId={cheque.id} />
        </CardBody>
      </Card>
    </div>
  );
}
