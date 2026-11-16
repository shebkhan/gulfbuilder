import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/domain/app-shell";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("common");

  return (
    <AppShell
      orgName={t("appName")}
      currency={t("currency")}
      role="org_admin"
      userName={t("appName")}
      active="/dashboard"
    >
      <div className="flex flex-col gap-2 pt-2">
        <span className="font-section-kicker text-section-kicker font-bold uppercase tracking-wider text-on-surface-variant">
          {t("appTagline")}
        </span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          {locale === "ar" ? "لوحة التحكم" : "Dashboard"}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {locale === "ar"
            ? "هيكل التطبيق جاهز. المصادقة وإعداد المؤسسة في الخطوة التالية."
            : "Shell is live. Authentication and organization setup land next."}
        </p>
      </div>
    </AppShell>
  );
}
