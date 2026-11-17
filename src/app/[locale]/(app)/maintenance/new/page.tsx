import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MaintenanceCreateForm } from "@/components/domain/maintenance-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

export default async function NewMaintenancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "maintenance.write")) return null;

  const t = await getTranslations("maintenance");
  const tc = await getTranslations("common");
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  const [{ data: rawBuildings }, { data: rawUnits }, { data: rawVendors }] = await Promise.all([
    ctx.supabase
      .from("buildings")
      .select("id, name, code")
      .is("deleted_at", null)
      .order("code"),
    ctx.supabase.from("units").select("id, unit_no, building_id").order("unit_no"),
    ctx.supabase.from("vendors").select("id, name").order("name"),
  ]);

  const buildings = (rawBuildings ?? []).map((b) => ({ id: b.id, name: b.name, code: b.code }));
  const units = (rawUnits ?? []).map((u) => ({
    id: u.id,
    unit_no: u.unit_no,
    building_id: u.building_id,
  }));
  const vendors = (rawVendors ?? []).map((v) => ({ id: v.id, name: v.name }));

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
          <CardTitle>{t("createRequest")}</CardTitle>
        </CardHeader>
        <CardBody>
          <MaintenanceCreateForm buildings={buildings} units={units} vendors={vendors} />
        </CardBody>
      </Card>
    </div>
  );
}
