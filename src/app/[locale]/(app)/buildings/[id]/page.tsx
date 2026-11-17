import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BuildingAccess } from "@/components/domain/building-access";
import { FloorsForm, UnitsForm } from "@/components/domain/bulk-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";

const STATUS_VARIANT: Record<string, "warning" | "success" | "info" | "danger"> = {
  vacant: "warning",
  occupied: "success",
  reserved: "info",
  maintenance: "danger",
};

export default async function BuildingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const t = await getTranslations("buildings");

  const { data: building } = await ctx.supabase
    .from("buildings")
    .select("id, code, name, city, street, zone, country_code")
    .eq("id", id)
    .maybeSingle();
  if (!building) notFound();

  const [{ data: floors }, { data: units }, { data: org }] = await Promise.all([
    ctx.supabase
      .from("floors")
      .select("id, level, label")
      .eq("building_id", id)
      .order("level"),
    ctx.supabase
      .from("units")
      .select("id, unit_no, floor_id, unit_type, area_sqm, default_rent_minor, currency, status")
      .eq("building_id", id)
      .is("deleted_at", null)
      .order("unit_no"),
    ctx.supabase.from("organizations").select("base_currency").eq("id", ctx.orgId).maybeSingle(),
  ]);

  const { data: staffRows } = await ctx.supabase
    .from("org_members")
    .select("user_id, role")
    .eq("org_id", ctx.orgId)
    .in("role", ["manager", "caretaker"]);

  const staffIds = (staffRows ?? []).map((row) => row.user_id);
  const [{ data: profiles }, { data: accessRows }] = await Promise.all([
    staffIds.length > 0
      ? ctx.supabase.from("profiles").select("id, full_name").in("id", staffIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    ctx.supabase.from("member_building_access").select("user_id").eq("building_id", id),
  ]);

  const nameOf = (userId: string) =>
    profiles?.find((profile) => profile.id === userId)?.full_name ?? "—";

  const staff = (staffRows ?? []).map((row) => ({ id: row.user_id, name: nameOf(row.user_id) }));
  const access = (accessRows ?? []).map((row) => ({
    userId: row.user_id,
    name: nameOf(row.user_id),
  }));

  const currency = org?.base_currency ?? "QAR";
  const writable = can(ctx.role, "properties.write");
  const floorRows = floors ?? [];
  const unitRows = units ?? [];
  const byFloor = floorRows
    .slice()
    .reverse()
    .map((floor) => ({
      ...floor,
      units: unitRows.filter((unit) => unit.floor_id === floor.id),
    }));

  const tLabels = {
    bulkFloors: t("bulkFloors"),
    bulkUnits: t("bulkUnits"),
    from: t("from"),
    to: t("to"),
    prefix: t("prefix"),
    start: t("start"),
    count: t("count"),
    pad: t("pad"),
    floor: t("floor"),
    type: t("type"),
    area: t("area"),
    rent: t("rent"),
    generate: t("generate"),
    generating: t("generating"),
    result: t.raw("result") as string,
    help: t.raw("help") as Record<string, string>,
    errors: t.raw("errors") as Record<string, string>,
  };

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="buildings"
        role={ctx.role}
        actions={
          <Link
            href="/buildings"
            className="w-fit font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
          >
            ← {t("title")}
          </Link>
        }
        title={building.name}
        description={
          <>
            {building.code}
            {[building.zone, building.street, building.city].filter(Boolean).length
              ? ` · ${[building.zone, building.street, building.city].filter(Boolean).join(", ")}`
              : ""}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("floors")}</CardTitle>
          </CardHeader>
          <CardBody>
            {floorRows.length === 0 ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant">{t("noFloors")}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {floorRows.map((floor) => (
                  <li
                    key={floor.id}
                    className="flex items-center justify-between border-b border-hairline py-1.5 last:border-0"
                  >
                    <span className="font-body-md text-body-md text-on-surface">
                      {floor.label ?? `${t("level")} ${floor.level}`}
                    </span>
                    <span className="font-label-md text-label-md text-on-surface-variant">
                      {unitRows.filter((unit) => unit.floor_id === floor.id).length} {t("units")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("stacking")}</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col gap-2">
              {byFloor.map((floor) => (
                <div key={floor.id} className="flex items-center gap-3">
                  <span className="w-10 shrink-0 font-label-sm text-label-sm text-on-surface-variant">
                    {floor.level}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {floor.units.length === 0 ? (
                      <span className="font-body-sm text-body-sm text-on-surface-variant/70">
                        {t("noUnits")}
                      </span>
                    ) : (
                      floor.units.map((unit) => (
                        <Link
                          key={unit.id}
                          href={`/units/${unit.id}`}
                          title={`${unit.unit_no} · ${t(`statuses.${unit.status}`)}`}
                          className="flex h-7 min-w-9 items-center justify-center rounded-md border border-hairline bg-surface-container-low px-1.5 font-label-sm text-label-sm text-on-surface hover:bg-surface-container-high"
                        >
                          {unit.unit_no}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {writable ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <FloorsForm buildingId={building.id} labels={tLabels} />
          {floorRows.length > 0 ? <UnitsForm floors={floorRows} labels={tLabels} /> : null}
        </div>
      ) : null}

      {ctx.role === "org_admin" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("access")}</CardTitle>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{t("accessHint")}</p>
          </CardHeader>
          <CardBody>
            <BuildingAccess
              buildingId={building.id}
              staff={staff}
              access={access}
              labels={{
                staff: t("staff"),
                grant: t("grant"),
                revoke: t("revoke"),
                noStaff: t("noStaff"),
                help: t.raw("help") as Record<string, string>,
                errors: t.raw("errors") as Record<string, string>,
              }}
            />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("units")}</CardTitle>
        </CardHeader>
        <CardBody>
          {unitRows.length === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">{t("noUnits")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-start font-body-sm text-body-sm">
                <thead>
                  <tr className="text-on-surface-variant">
                    <th className="py-1.5 text-start font-medium">{t("unitNo")}</th>
                    <th className="py-1.5 text-start font-medium">{t("type")}</th>
                    <th className="py-1.5 text-start font-medium">{t("area")}</th>
                    <th className="py-1.5 text-start font-medium">{t("rent")}</th>
                    <th className="py-1.5 text-start font-medium">{t("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {unitRows.map((unit) => (
                    <tr key={unit.id} className="border-t border-hairline">
                      <td className="py-1.5">
                        <Link href={`/units/${unit.id}`} className="text-primary hover:underline">
                          {unit.unit_no}
                        </Link>
                      </td>
                      <td className="py-1.5">{unit.unit_type ?? "—"}</td>
                      <td className="py-1.5 tabular">{unit.area_sqm ?? "—"}</td>
                      <td className="py-1.5 tabular">
                        {unit.default_rent_minor === null
                          ? "—"
                          : formatMoney(
                              BigInt(unit.default_rent_minor),
                              unit.currency ?? currency,
                              locale,
                            )}
                      </td>
                      <td className="py-1.5">
                        <Badge
                          variant={STATUS_VARIANT[unit.status] ?? "neutral"}
                          dot={unit.status !== "vacant"}
                        >
                          {t(`statuses.${unit.status}`)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
