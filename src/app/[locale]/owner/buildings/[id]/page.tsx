import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnerScope } from "@/server/queries/owner-portal";
import { EmptyState } from "@/components/domain/empty-state";

export default async function OwnerBuildingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("owner.buildings");
  const scope = await getOwnerScope();
  if (!scope) return null;

  if (!scope.buildingIds.includes(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: building } = await supabase
    .from("buildings")
    .select("id, code, name, city, zone, street, units(id, unit_no, status, default_rent_minor, currency)")
    .eq("id", id)
    .maybeSingle();

  if (!building) notFound();

  const units = (building.units ?? []) as {
    id: string;
    unit_no: string;
    status: string;
    default_rent_minor: number | null;
    currency: string | null;
  }[];

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          {building.code} — {building.name}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {[building.zone, building.street, building.city].filter(Boolean).join(", ") || "—"}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("units")}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {units.length === 0 ? (
            <EmptyState animation="/animations/empty-box.lottie" description={t("empty")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-start font-body-sm text-body-sm">
                <thead>
                  <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                    <th className="p-3 text-start">{t("unit")}</th>
                    <th className="p-3 text-start">{t("status")}</th>
                    <th className="p-3 text-end">{t("rent")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {units.map((u) => (
                    <tr key={u.id}>
                      <td className="p-3 font-medium text-on-surface">{u.unit_no}</td>
                      <td className="p-3">
                        <Badge
                          variant={
                            u.status === "occupied"
                              ? "success"
                              : u.status === "maintenance"
                                ? "danger"
                                : "neutral"
                          }
                        >
                          {u.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-end text-on-surface">
                        {u.default_rent_minor !== null && u.currency
                          ? `${u.currency} ${(u.default_rent_minor / 100).toFixed(2)}`
                          : "—"}
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
