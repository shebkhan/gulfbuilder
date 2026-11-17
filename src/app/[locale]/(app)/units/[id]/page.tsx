import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";

export default async function UnitPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const t = await getTranslations("buildings");

  const { data: unit } = await ctx.supabase
    .from("units")
    .select(
      "id, unit_no, unit_type, occupancy_type, bedrooms, bathrooms, area_sqm, furnished, rentable_as, default_rent_minor, currency, status, building_id, floor_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!unit) notFound();

  const [{ data: building }, { data: floor }, { data: rooms }] = await Promise.all([
    ctx.supabase.from("buildings").select("id, name, code").eq("id", unit.building_id).maybeSingle(),
    ctx.supabase.from("floors").select("level, label").eq("id", unit.floor_id).maybeSingle(),
    ctx.supabase
      .from("rooms")
      .select("id, room_no, capacity, private_bathroom, default_rent_minor, status")
      .eq("unit_id", id)
      .is("deleted_at", null)
      .order("room_no"),
  ]);

  const currency = unit.currency ?? "QAR";
  const facts: [string, string][] = [
    [t("type"), unit.unit_type ?? "—"],
    [t("area"), unit.area_sqm ? String(unit.area_sqm) : "—"],
    [t("rent"), unit.default_rent_minor === null ? "—" : formatMoney(BigInt(unit.default_rent_minor), currency, locale)],
    [t("floor"), floor?.label ?? (floor ? `${t("level")} ${floor.level}` : "—")],
  ];

  return (
    <div className="flex max-w-4xl flex-col gap-space-lg pt-2">
      <PageHeader
        section="buildings"
        role={ctx.role}
        title={`${t("unitNo")} ${unit.unit_no}`}
        description={building ? building.code : ""}
        actions={
          <>
            <Link
              href={`/buildings/${unit.building_id}`}
              className="w-fit font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
            >
              ← {building?.name ?? t("title")}
            </Link>
            <Badge variant={unit.status === "occupied" ? "success" : "neutral"}>
              {t(`statuses.${unit.status}`)}
            </Badge>
          </>
        }
      />

      <Card>
        <CardBody className="pt-5">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {facts.map(([label, value]) => (
              <div key={label} className="flex flex-col">
                <dt className="font-section-kicker text-section-kicker uppercase tracking-wider text-on-surface-variant">
                  {label}
                </dt>
                <dd className="font-body-md text-body-md text-on-surface tabular">{value}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("rooms")}</CardTitle>
        </CardHeader>
        <CardBody>
          {!rooms || rooms.length === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">{t("noUnits")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {rooms.map((room) => (
                <li
                  key={room.id}
                  className="flex items-center justify-between border-b border-hairline py-1.5 last:border-0"
                >
                  <span className="font-body-md text-body-md text-on-surface">{room.room_no}</span>
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    {room.capacity} ·{" "}
                    {room.default_rent_minor === null
                      ? "—"
                      : formatMoney(BigInt(room.default_rent_minor), unit.currency ?? currency, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
