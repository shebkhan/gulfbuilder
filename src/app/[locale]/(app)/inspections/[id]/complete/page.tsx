import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { InspectionCompleteForm, type InspectionItem } from "@/components/domain/inspection-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

export default async function CompleteInspectionPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "maintenance.write")) return null;

  const t = await getTranslations("inspections");
  const tc = await getTranslations("common");
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  const { data: row } = await ctx.supabase
    .from("inspections")
    .select(`
      id,
      kind,
      data,
      completed_at,
      tenant_signed,
      notes,
      created_at,
      leases (
        id,
        lease_no,
        tenants ( id, full_name )
      )
    `)
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();

  const leaseData = row.leases as unknown as {
    id: string;
    lease_no: string;
    tenants: { id: string; full_name: string } | null;
  } | null;

  const inspection: InspectionItem = {
    id: row.id,
    kind: row.kind as InspectionItem["kind"],
    data: (row.data || {}) as Record<string, unknown>,
    completed_at: row.completed_at,
    tenant_signed: row.tenant_signed,
    notes: row.notes,
    created_at: row.created_at,
    lease: leaseData
      ? {
          id: leaseData.id,
          lease_no: leaseData.lease_no,
          tenant: leaseData.tenants,
        }
      : null,
  };

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
          <CardTitle>
            {t("complete")}: {inspection.lease?.lease_no} (
            {inspection.kind === "move_in" ? t("moveIn") : t("moveOut")})
          </CardTitle>
        </CardHeader>
        <CardBody>
          <InspectionCompleteForm inspection={inspection} />
        </CardBody>
      </Card>
    </div>
  );
}
