import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MeterForms } from "@/components/domain/meter-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getOrgContext } from "@/server/org-context";

export default async function NewMeterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const t = await getTranslations("meters");
  const tc = await getTranslations("common");
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  const [{ data: meters }, { data: buildings }] = await Promise.all([
    ctx.supabase
      .from("meters")
      .select("id, kind, meter_no, buildings(code)")
      .order("kind"),
    ctx.supabase.from("buildings").select("id, code, name").order("code"),
  ]);

  const buildingOptions = (buildings ?? []).map((b) => ({ id: b.id, label: `${b.code} — ${b.name}` }));
  const meterOptions = (meters ?? []).map((m) => {
    const building = m.buildings as unknown as { code: string } | null;
    return {
      id: m.id,
      label: `${building?.code ?? "—"} · ${m.kind}${m.meter_no ? ` (${m.meter_no})` : ""}`,
    };
  });

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex items-center gap-3">
        <Link
          href="/meters"
          className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
        >
          <BackIcon className="h-4 w-4" />
          <span>{tc("back")}</span>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("newMeter")}</CardTitle>
        </CardHeader>
        <CardBody>
          <MeterForms buildings={buildingOptions} meters={meterOptions} />
        </CardBody>
      </Card>
    </div>
  );
}
