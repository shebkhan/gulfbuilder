import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MaintenanceStatusForm, type MaintenanceItem } from "@/components/domain/maintenance-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

export default async function MaintenanceStatusPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "maintenance.write")) return null;

  const t = await getTranslations("maintenance");
  const tc = await getTranslations("common");
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  const { data: row } = await ctx.supabase
    .from("maintenance_requests")
    .select(`
      id,
      title,
      description,
      category,
      priority,
      status,
      cost_minor,
      currency,
      opened_at,
      resolved_at,
      buildings ( id, name, code ),
      units ( id, unit_no ),
      tenants ( id, full_name ),
      vendors ( id, name )
    `)
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();

  const request: MaintenanceItem = {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority as MaintenanceItem["priority"],
    status: row.status as MaintenanceItem["status"],
    cost_minor: row.cost_minor,
    currency: row.currency,
    opened_at: row.opened_at,
    resolved_at: row.resolved_at,
    building: row.buildings as unknown as { id: string; name: string; code: string } | null,
    unit: row.units as unknown as { id: string; unit_no: string } | null,
    tenant: row.tenants as unknown as { id: string; full_name: string } | null,
    vendor: row.vendors as unknown as { id: string; name: string } | null,
  };

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex items-center gap-3">
        <Link
          href="/maintenance"
          className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
        >
          <BackIcon className="h-4 w-4" />
          <span>{tc("back")}</span>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            {t("updateStatus")}: {request.title}
          </CardTitle>
        </CardHeader>
        <CardBody>
          <MaintenanceStatusForm request={request} />
        </CardBody>
      </Card>
    </div>
  );
}
