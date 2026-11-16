import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("common");

  return (
    <main className="flex min-h-screen items-center justify-center p-margin-mobile lg:p-margin">
      <div className="w-full max-w-md rounded-frame border border-outline-variant bg-surface-container-lowest p-space-xl shadow-canvas">
        <p className="font-section-kicker text-section-kicker uppercase text-on-surface-variant">
          {t("appTagline")}
        </p>
        <h1 className="mt-space-sm font-headline-lg text-headline-lg text-on-surface">
          {t("appName")}
        </h1>
        <p className="mt-space-md font-body-md text-body-md text-on-surface-variant">
          {locale === "ar"
            ? "تم إعداد التطبيق. لوحة التحكم قادمة في المرحلة التالية."
            : "Scaffold is running. The authenticated shell lands in M0 step 5."}
        </p>
        <p className="tabular mt-space-lg font-metric-num text-metric-num text-primary">
          {t("currency")} 1,240,000
        </p>
      </div>
    </main>
  );
}
