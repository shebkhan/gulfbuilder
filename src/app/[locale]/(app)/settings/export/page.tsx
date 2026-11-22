import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExportButtons } from "@/components/domain/export-buttons";
import { SettingsNav } from "@/components/domain/settings-nav";
import { can } from "@/lib/rbac";
import { getOrgContext } from "@/server/org-context";
import { PageHeader } from "@/components/domain/page-header";

export default async function ExportSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext();
  if (!ctx) redirect(`/${locale}/login`);
  if (!can(ctx.role, "settings.write")) redirect(`/${locale}/dashboard`);

  const role = ctx.role;

  const t = await getTranslations("settings.export");

  return (
    <div className="flex flex-col gap-space-lg pt-2">
      <PageHeader
        section="settings"
        role={role}
        title={t("title")}
        description={t("subtitle")}
      />

      <SettingsNav />

      <ExportButtons />
    </div>
  );
}
