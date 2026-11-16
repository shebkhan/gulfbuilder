import { Building2 } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ListPagination } from "@/components/domain/list-pagination";
import { Card, CardBody } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { paginate } from "@/lib/pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnerScope } from "@/server/queries/owner-portal";

type SearchParams = Promise<{ page?: string }>;

export default async function OwnerBuildingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { page } = await searchParams;
  const t = await getTranslations("owner.buildings");
  const scope = await getOwnerScope();
  if (!scope) return null;

  const supabase = await createSupabaseServerClient();
  const { data: buildings } = scope.buildingIds.length
    ? await supabase
        .from("buildings")
        .select("id, code, name, city, units(id, status)")
        .in("id", scope.buildingIds)
        .order("code")
    : { data: [] as never[] };

  const paged = paginate(buildings ?? [], Number(page ?? 1));

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
      </div>

      {(buildings ?? []).length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 p-12 text-center">
            <Building2 className="size-12 text-on-surface-variant/40" />
            <p className="font-body-md text-body-md text-on-surface-variant">{t("empty")}</p>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paged.rows.map((b) => {
              const units = (b.units ?? []) as { id: string; status: string }[];
              const occupied = units.filter((u) => u.status === "occupied").length;
              const pct = units.length ? Math.round((occupied / units.length) * 100) : 0;
              return (
                <Link key={b.id} href={`/owner/buildings/${b.id}`}>
                  <Card className="transition-shadow hover:shadow-card">
                    <CardBody className="flex flex-col gap-2 p-5">
                      <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                        {b.code} — {b.name}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        {b.city ?? "—"}
                      </span>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        {occupied} / {units.length} {t("unitsOccupied")}
                      </span>
                    </CardBody>
                  </Card>
                </Link>
              );
            })}
          </div>

          <ListPagination
            page={paged.page}
            pages={paged.pages}
            total={paged.total}
            href="/owner/buildings"
          />
        </>
      )}
    </div>
  );
}
