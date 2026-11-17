import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TenantForm } from "@/components/domain/tenant-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

export default async function NewTenantPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "tenants.write")) return null;

  const t = await getTranslations("tenants");
  const tc = await getTranslations("common");
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex items-center gap-3">
        <Link
          href="/tenants"
          className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
        >
          <BackIcon className="h-4 w-4" />
          <span>{tc("back")}</span>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("new")}</CardTitle>
        </CardHeader>
        <CardBody>
          <TenantForm
            labels={{
              fullName: t("fullName"),
              kind: t("kind"),
              person: t("person"),
              company: t("company"),
              language: t("language"),
              arabic: t("arabic"),
              english: t("english"),
              idNumber: t("idNumber"),
              idNumberPlaceholder: t("idNumberPlaceholder"),
              phone: t("phone"),
              whatsapp: t("whatsapp"),
              email: t("email"),
              nationality: t("nationality"),
              employer: t("employer"),
              create: t("create"),
              creating: t("creating"),
              created: t("created"),
              help: t.raw("help") as Record<string, string>,
              errors: t.raw("errors") as Record<string, string>,
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
