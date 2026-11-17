import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { InspectionCreateForm } from "@/components/domain/inspection-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

export default async function NewInspectionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "maintenance.write")) return null;

  const t = await getTranslations("inspections");
  const tc = await getTranslations("common");
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  const { data: rawLeases } = await ctx.supabase
    .from("leases")
    .select("id, lease_no, tenants ( full_name )")
    .in("status", ["active", "draft", "terminated"])
    .order("lease_no");

  const leases = (rawLeases ?? []).map((l) => {
    const tenant = l.tenants as unknown as { full_name: string } | null;
    return {
      id: l.id,
      lease_no: l.lease_no,
      tenant_name: tenant?.full_name || tc("unknown"),
    };
  });

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex items-center gap-3">
        <Link
          href="/inspections"
          className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
        >
          <BackIcon className="h-4 w-4" />
          <span>{tc("back")}</span>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("newInspection")}</CardTitle>
        </CardHeader>
        <CardBody>
          <InspectionCreateForm leases={leases} />
        </CardBody>
      </Card>
    </div>
  );
}
