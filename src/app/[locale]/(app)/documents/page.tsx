import { FileText, Plus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DateCell, DaysLeft } from "@/components/domain/date-cell";
import { ListPagination } from "@/components/domain/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { paginate } from "@/lib/pagination";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";

type SearchParams = Promise<{ page?: string }>;

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { page } = await searchParams;
  const t = await getTranslations("documents");
  const tc = await getTranslations("common");
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const { data: documents } = await ctx.supabase
    .from("documents")
    .select("id, entity_type, entity_id, kind, path, expires_on, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const writable = can(ctx.role, "maintenance.write") || can(ctx.role, "finance.write");

  const paged = paginate(documents ?? [], Number(page ?? 1));

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="documents"
        role={ctx.role}
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-3">
        {writable ? (
          <Button asChild>
            <Link href="/documents/upload">
              <Plus aria-hidden />
              {t("upload")}
            </Link>
          </Button>
        ) : null}
          </div>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("list")}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {!documents || documents.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <FileText className="size-12 text-on-surface-variant/40" />
              <p className="font-body-md text-body-md text-on-surface-variant">{t("empty")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-start font-body-sm text-body-sm">
                <thead>
                  <tr className="border-b border-hairline bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                    <th className="p-3 text-start">{t("kind")}</th>
                    <th className="p-3 text-start">{t("entityType")}</th>
                    <th className="p-3 text-start">{t("expiresOn")}</th>
                    <th className="p-3 text-start">{tc("daysLeftHeader")}</th>
                    <th className="p-3 text-start">{t("uploadedOn")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {paged.rows.map((d) => (
                    <tr key={d.id}>
                      <td className="p-3 font-medium text-on-surface">
                        {t(`kinds.${d.kind}` as never)}
                      </td>
                      <td className="p-3 text-on-surface-variant">
                        {t(`entityTypes.${d.entity_type}` as never)}
                      </td>
                      <td className="p-3">
                        {d.expires_on ? (
                          <Badge
                            variant={
                              d.expires_on < new Date().toISOString().slice(0, 10)
                                ? "danger"
                                : "warning"
                            }
                          >
                            <DateCell date={d.expires_on} locale={locale} />
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 text-on-surface-variant">
                        {d.expires_on ? <DaysLeft date={d.expires_on} /> : "—"}
                      </td>
                      <td className="p-3 text-on-surface-variant">
                        <DateCell date={d.created_at} locale={locale} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <ListPagination
            page={paged.page}
            pages={paged.pages}
            total={paged.total}
            href="/documents"
          />
        </CardBody>
      </Card>
    </div>
  );
}
