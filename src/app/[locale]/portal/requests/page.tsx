import { Plus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DateCell } from "@/components/domain/date-cell";
import { ListPagination } from "@/components/domain/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { paginate } from "@/lib/pagination";
import { getTenantPortalData } from "@/server/queries/tenant-portal";
import { EmptyState } from "@/components/domain/empty-state";

type SearchParams = Promise<{ page?: string }>;

export default async function PortalRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { page } = await searchParams;
  const t = await getTranslations("portal.requests");
  const data = await getTenantPortalData();
  if (!data) return null;

  const paged = paginate(data.requests, Number(page ?? 1));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
        <Button asChild>
          <Link href="/portal/requests/new">
            <Plus aria-hidden />
            {t("newTitle")}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("list")}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {data.requests.length === 0 ? (
            <EmptyState animation="/animations/empty-box.lottie" description={t("empty")} />
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {paged.rows.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-body-md text-body-md font-medium text-on-surface">
                      {r.title}
                    </span>
                    <Badge variant={r.status === "resolved" ? "success" : "info"}>
                      {t(`status.${r.status}` as never)}
                    </Badge>
                  </div>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    <DateCell date={r.opened_at} locale={locale} /> ·{" "}
                    {t(`priorities.${r.priority}` as never)}
                  </span>
                  {r.description && (
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {r.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <ListPagination
            page={paged.page}
            pages={paged.pages}
            total={paged.total}
            href="/portal/requests"
          />
        </CardBody>
      </Card>
    </div>
  );
}
