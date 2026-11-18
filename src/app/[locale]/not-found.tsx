"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("errors");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("notFoundTitle")}</h1>
      <p className="font-body-md text-body-md text-on-surface-variant">
        {t("notFoundDescription")}
      </p>
      <Button asChild>
        <Link href="/dashboard">{t("dashboard")}</Link>
      </Button>
    </main>
  );
}
