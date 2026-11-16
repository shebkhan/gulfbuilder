import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("common");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-container-low p-margin-mobile lg:p-margin">
      <div className="w-full max-w-md rounded-frame bg-surface-container-lowest p-space-xl shadow-canvas">
        <Link href="/" className="flex flex-col gap-0.5">
          <span className="font-headline-sm text-headline-sm text-on-surface">{t("appName")}</span>
          <span className="font-section-kicker text-section-kicker uppercase tracking-wider text-on-surface-variant">
            {t("appTagline")}
          </span>
        </Link>
        <div className="mt-space-xl">{children}</div>
      </div>
    </div>
  );
}
