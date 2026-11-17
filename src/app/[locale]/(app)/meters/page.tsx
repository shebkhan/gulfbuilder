import { Gauge, Plus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DateCell } from "@/components/domain/date-cell";
import { ListPagination } from "@/components/domain/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { paginate } from "@/lib/pagination";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";

type SearchParams = Promise<{ page?: string }>;

export default async function MetersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { page } = await searchParams;
  const t = await getTranslations("meters");
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const [{ data: meters }, { data: readings }] = await Promise.all([
    ctx.supabase
      .from("meters")
      .select("id, kind, meter_no, building_id, unit_id, buildings(code, name)")
      .order("kind"),
    ctx.supabase
      .from("meter_readings")
      .select("id, meter_id, read_on, value")
      .order("read_on", { ascending: false })
      .limit(300),
  ]);

  const readingsByMeter = new Map<string, { read_on: string; value: number }[]>();
  for (const r of readings ?? []) {
    const list = readingsByMeter.get(r.meter_id) ?? [];
    list.push({ read_on: r.read_on, value: Number(r.value) });
    readingsByMeter.set(r.meter_id, list);
  }

  const paged = paginate(meters ?? [], Number(page ?? 1));

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="meters"
        role={ctx.role}
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link href="/meters/new">
            <Plus aria-hidden />
            {t("newMeter")}
          </Link>
        </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("list")}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {!meters || meters.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Gauge className="size-12 text-on-surface-variant/40" />
              <p className="font-body-md text-body-md text-on-surface-variant">{t("empty")}</p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {paged.rows.map((m) => {
                const history = readingsByMeter.get(m.id) ?? [];
                const latest = history[0];
                const previous = history[1];
                const consumption =
                  latest && previous ? latest.value - previous.value : null;
                const building = m.buildings as unknown as { code: string; name: string } | null;
                return (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="flex flex-col">
                      <span className="font-body-md text-body-md font-medium text-on-surface">
                        <Link
                          href={`/buildings/${m.building_id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {building?.code ?? "—"}
                        </Link>{" "}
                        · {t(`kinds.${m.kind}` as never)}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        {m.meter_no ?? "—"}
                        {latest ? (
                          <>
                            {" · "}
                            {t("lastReading")}: {latest.value} ({" "}
                            <DateCell date={latest.read_on} locale={locale} />)
                          </>
                        ) : null}
                      </span>
                    </div>
                    {consumption !== null && (
                      <Badge variant="info">
                        {t("consumption")}: {consumption}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <ListPagination
            page={paged.page}
            pages={paged.pages}
            total={paged.total}
            href="/meters"
          />
        </CardBody>
      </Card>
    </div>
  );
}
