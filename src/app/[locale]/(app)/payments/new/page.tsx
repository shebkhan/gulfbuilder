import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PaymentForm } from "@/components/domain/payment-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

export default async function NewPaymentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx || !(can(ctx.role, "finance.write") || ctx.role === "manager")) return null;

  const t = await getTranslations("payments");
  const tc = await getTranslations("common");
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  const [{ data: rawBuildings }, { data: rawLeases }] = await Promise.all([
    ctx.supabase.from("buildings").select("id, code, name").order("code"),
    ctx.supabase
      .from("leases")
      .select("id, lease_no, tenant_id")
      .in("status", ["active", "draft"])
      .order("lease_no"),
  ]);

  const buildingOptions = (rawBuildings ?? []).map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
  }));
  const leaseOptions = (rawLeases ?? []).map((l) => ({
    id: l.id,
    lease_no: l.lease_no,
    tenant_id: l.tenant_id,
  }));

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex items-center gap-3">
        <Link
          href="/payments"
          className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
        >
          <BackIcon className="h-4 w-4" />
          <span>{tc("back")}</span>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("recordPayment")}</CardTitle>
        </CardHeader>
        <CardBody>
          <PaymentForm
            buildings={buildingOptions}
            leases={leaseOptions}
            locale={locale}
            currency={ctx.currency}
          />
        </CardBody>
      </Card>
    </div>
  );
}
