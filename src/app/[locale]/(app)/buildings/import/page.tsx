import { getTranslations, setRequestLocale } from "next-intl/server";
import { ImportForm } from "@/components/domain/import-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domain/page-header";

export default async function ImportBuildingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) redirect(`/${locale}/login`);
  if (!can(ctx.role, "properties.write")) redirect(`/${locale}/buildings`);

  const t = await getTranslations("buildings");

  return (
    <div className="flex max-w-3xl flex-col gap-space-lg pt-2">
      <PageHeader
        section="buildings"
        role={ctx.role}
        title={t("importTitle")}
        description={t("importSubtitle")}
        actions={
          <Link
            href="/buildings"
            className="w-fit font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
          >
            ← {t("title")}
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("file")}</CardTitle>
        </CardHeader>
        <CardBody>
          <ImportForm
            labels={{
              file: t("file"),
              dryRun: t("dryRun"),
              commit: t("commit"),
              report: t.raw("report") as string,
              committed: t("committed"),
              nothingWritten: t("nothingWritten"),
              row: t("row"),
              message: t("message"),
              help: t.raw("help") as Record<string, string>,
              errors: t.raw("errors") as Record<string, string>,
            }}
          />
        </CardBody>
      </Card>

      <p className="font-body-sm text-body-sm text-on-surface-variant" dir="ltr">
        {t("template")}
      </p>
    </div>
  );
}
