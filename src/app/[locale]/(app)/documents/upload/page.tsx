import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DocumentUploadForm } from "@/components/domain/document-upload-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

export default async function UploadDocumentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx || !(can(ctx.role, "maintenance.write") || can(ctx.role, "finance.write")))
    return null;

  const t = await getTranslations("documents");
  const tc = await getTranslations("common");
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;

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
    ...(tenants ?? []).map((x) => ({ id: x.id, label: `${x.full_name} ${t("tenantTag")}` })),
    ...(buildings ?? []).map((b) => ({ id: b.id, label: `${b.code} — ${b.name} ${t("buildingTag")}` })),
  ];

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex items-center gap-3">
        <Link
          href="/documents"
          className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
        >
          <BackIcon className="h-4 w-4" />
          <span>{tc("back")}</span>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("upload")}</CardTitle>
        </CardHeader>
        <CardBody>
          <DocumentUploadForm entities={entities} />
        </CardBody>
      </Card>
    </div>
  );
}
