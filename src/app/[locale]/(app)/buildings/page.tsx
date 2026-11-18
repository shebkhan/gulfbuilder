import { Building2, Plus, Users } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/domain/page-header";
import { Button } from "@/components/ui/button";
import { ListPagination } from "@/components/domain/list-pagination";
import { Link } from "@/i18n/navigation";
import { PAGE_SIZE, getPaginationRange, toPaginated } from "@/lib/pagination";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

type SearchParams = Promise<{ page?: string }>;

export default async function BuildingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const { page } = await searchParams;
  const t = await getTranslations("buildings");
  const writable = can(ctx.role, "properties.write");

  const currentPage = Math.max(1, Number(page ?? 1));
  const { from, to } = getPaginationRange(currentPage, PAGE_SIZE);

  const [{ data: buildings, count }, { data: owners }, { data: floors }, { data: units }] =
    await Promise.all([
      ctx.supabase
        .from("buildings")
        .select("id, code, name, city, owner_id", { count: "exact" })
        .is("deleted_at", null)
        .order("code")
        .range(from, to),
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
  const occupancyBy = (units ?? []).reduce<Record<string, { occupied: number; vacant: number }>>(
    (acc, unit) => {
      const entry = (acc[unit.building_id] ??= { occupied: 0, vacant: 0 });
      if (unit.status === "occupied") entry.occupied += 1;
      else entry.vacant += 1;
      return acc;
    },
    {},
  );

  const paged = toPaginated(buildings, count, currentPage);

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="buildings"
        role={ctx.role}
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-3">
          {writable ? (
            <Link
              href="/buildings/import"
              className="font-label-md text-label-md text-primary underline-offset-4 hover:underline"
            >
              {t("import")}
            </Link>
          ) : null}
          {writable && owners && owners.length > 0 ? (
            <Button asChild>
              <Link href="/buildings/new">
                <Plus aria-hidden />
                {t("new")}
              </Link>
            </Button>
          ) : null}
          </div>
        }
      />

      {paged.total > 0 ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {paged.rows.map((building) => {
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
                      <div className="h-full bg-secondary" style={{ width: `${occupiedPct}%` }} />
                    </div>
                    <div className="flex items-center justify-between gap-3 font-body-sm text-body-sm text-on-surface-variant">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-secondary" aria-hidden />
                        {t("occupied")} {occupancy.occupied}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full bg-surface-container-high"
                          aria-hidden
                        />
                        {t("vacant")} {occupancy.vacant}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between border-t border-hairline pt-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                      <Users className="size-3.5" />
                      <span>{t("viewTenants")}</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          <ListPagination
            page={paged.page}
            pages={paged.pages}
            total={paged.total}
            href="/buildings"
          />
        </>
      ) : (
        <p className="font-body-md text-body-md text-on-surface-variant">{t("empty")}</p>
      )}
    </div>
  );
}
