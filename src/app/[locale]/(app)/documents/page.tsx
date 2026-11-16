import { FileText } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DocumentUploadForm } from "@/components/domain/document-upload-form";
import { FormDialog } from "@/components/domain/form-dialog";
import { ListPagination } from "@/components/domain/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { paginate } from "@/lib/pagination";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

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
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const [{ data: leases }, { data: tenants }, { data: buildings }] = await Promise.all([
    ctx.supabase
      .from("leases")
      .select("id, lease_no, tenants(full_name)")
      .order("lease_no")
      .limit(200),
    ctx.supabase.from("tenants").select("id, full_name").order("full_name").limit(200),
    ctx.supabase.from("buildings").select("id, code, name").order("code").limit(200),
  ]);

  const entities = [
    ...(leases ?? []).map((l) => ({
      id: l.id,
      label: `${l.lease_no}${(l.tenants as unknown as { full_name: string } | null)?.full_name ? ` — ${(l.tenants as unknown as { full_name: string }).full_name}` : ""}`,
    })),
    ...(tenants ?? []).map((x) => ({ id: x.id, label: `${x.full_name} (tenant)` })),
    ...(buildings ?? []).map((b) => ({ id: b.id, label: `${b.code} — ${b.name} (building)` })),
  ];

  const { data: documents } = await ctx.supabase
    .from("documents")
    .select("id, entity_type, entity_id, kind, path, expires_on, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const writable = can(ctx.role, "maintenance.write") || can(ctx.role, "finance.write");

  const paged = paginate(documents ?? [], Number(page ?? 1));

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
          <p className="max-w-xl font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
        </div>
        {writable ? (
          <FormDialog title={t("upload")} triggerLabel={t("upload")}>
            <DocumentUploadForm entities={entities} />
          </FormDialog>
        ) : null}
      </div>

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
                            {d.expires_on}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 text-on-surface-variant">
                        {new Date(d.created_at).toLocaleDateString(locale)}
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
