import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BuildingForm } from "@/components/domain/building-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";

export default async function NewBuildingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx || !can(ctx.role, "properties.write")) return null;

  const t = await getTranslations("buildings");
  const tc = await getTranslations("common");
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  const { data: owners } = await ctx.supabase
    .from("owners")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <div className="flex items-center gap-3">
        <Link
          href="/buildings"
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
          <BuildingForm
            owners={owners ?? []}
            labels={{
              code: t("code"),
              name: t("name"),
              owner: t("owner"),
              city: t("city"),
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
