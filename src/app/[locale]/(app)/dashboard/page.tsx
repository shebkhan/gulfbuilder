import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");

  return (
    <div className="flex flex-col gap-2 pt-2">
      <span className="font-section-kicker text-section-kicker font-bold uppercase tracking-wider text-on-surface-variant">
        {t("orgCreated")}
      </span>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("title")}</h1>
      <p className="max-w-xl font-body-md text-body-md text-on-surface-variant">{t("empty")}</p>
    </div>
  );
}
