import { Building2 } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BuildingForm } from "@/components/domain/building-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

export default async function BuildingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const t = await getTranslations("buildings");
  const writable = can(ctx.role, "properties.write");

  const [{ data: buildings }, { data: owners }, { data: floors }, { data: units }] =
    await Promise.all([
      ctx.supabase
        .from("buildings")
        .select("id, code, name, city, owner_id")
        .is("deleted_at", null)
        .order("code"),
      ctx.supabase.from("owners").select("id, name").is("deleted_at", null).order("name"),
      ctx.supabase.from("floors").select("building_id"),
      ctx.supabase.from("units").select("building_id, status"),
    ]);

  const countBy = (rows: { building_id: string }[] | null) =>
    (rows ?? []).reduce<Record<string, number>>((acc, row) => {
      acc[row.building_id] = (acc[row.building_id] ?? 0) + 1;
      return acc;
    }, {});
  const floorCount = countBy(floors);
  const unitCount = countBy(units);

  // Occupancy per building: occupied units against every unit that is not occupied.
  const occupancyBy = (units ?? []).reduce<
    Record<string, { occupied: number; vacant: number }>
  >((acc, unit) => {
    const entry = (acc[unit.building_id] ??= { occupied: 0, vacant: 0 });
    if (unit.status === "occupied") entry.occupied += 1;
    else entry.vacant += 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
        </div>
        {writable ? (
          <Link
            href="/buildings/import"
            className="font-label-md text-label-md text-primary underline-offset-4 hover:underline"
          >
            {t("import")}
          </Link>
        ) : null}
      </div>

      {writable && owners && owners.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("new")}</CardTitle>
          </CardHeader>
          <CardBody>
            <BuildingForm
              owners={owners}
              labels={{
                code: t("code"),
                name: t("name"),
                owner: t("owner"),
                city: t("city"),
                create: t("create"),
                creating: t("creating"),
                created: t("created"),
                errors: t.raw("errors") as Record<string, string>,
              }}
            />
          </CardBody>
        </Card>
      ) : null}

      {buildings && buildings.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {buildings.map((building) => {
            const occupancy = occupancyBy[building.id] ?? { occupied: 0, vacant: 0 };
            const totalUnits = occupancy.occupied + occupancy.vacant;
            const occupiedPct = totalUnits ? (occupancy.occupied / totalUnits) * 100 : 0;
            return (
              <Link
                key={building.id}
                href={`/buildings/${building.id}`}
                className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-container-lowest p-5 shadow-card transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="font-headline-sm text-headline-sm text-on-surface">
                      {building.name}
                    </span>
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                      {building.code}
                      {building.city ? ` · ${building.city}` : ""}
                    </span>
                  </div>
                  <Building2 className="size-5 text-on-surface-variant" aria-hidden />
                </div>
                <div className="mt-2 flex gap-6">
                  <div className="flex flex-col">
                    <span className="font-section-kicker text-section-kicker uppercase tracking-wider text-on-surface-variant">
                      {t("floors")}
                    </span>
                    <span className="font-metric-num text-metric-num text-on-surface">
                      {floorCount[building.id] ?? 0}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-section-kicker text-section-kicker uppercase tracking-wider text-on-surface-variant">
                      {t("units")}
                    </span>
                    <span className="font-metric-num text-metric-num text-on-surface">
                      {unitCount[building.id] ?? 0}
                    </span>
                  </div>
                </div>

                {/* Occupancy bar: occupied units against the vacant ones. */}
                <div className="mt-3 flex flex-col gap-1.5">
                  <div
                    className="flex h-2 w-full overflow-hidden rounded-full bg-surface-container-high"
                    role="img"
                    aria-label={`${t("occupied")}: ${occupancy.occupied}, ${t("vacant")}: ${occupancy.vacant}`}
                  >
                    <div
                      className="h-full bg-secondary"
                      style={{ width: `${occupiedPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 font-body-sm text-body-sm text-on-surface-variant">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-secondary" aria-hidden />
                      {t("occupied")} {occupancy.occupied}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-surface-container-high" aria-hidden />
                      {t("vacant")} {occupancy.vacant}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="font-body-md text-body-md text-on-surface-variant">{t("empty")}</p>
      )}
    </div>
  );
}
