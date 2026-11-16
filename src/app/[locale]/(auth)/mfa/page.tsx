import { getTranslations, setRequestLocale } from "next-intl/server";
import { MfaForm } from "@/components/domain/mfa-form";

export default async function MfaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next } = await searchParams;
  const t = await getTranslations("auth");
  const tc = await getTranslations("common");

  return (
    <MfaForm
      next={next?.startsWith(`/${locale}/`) ? next : `/${locale}/dashboard`}
      labels={{
        title: t("mfaTitle"),
        subtitle: t("mfaSubtitle"),
        enroll: t("mfaEnroll"),
        scan: t("mfaScan"),
        secret: t("mfaSecret"),
        code: t("mfaCode"),
        verify: t("mfaVerify"),
        pending: tc("loading"),
        failed: t("mfaFailed"),
      }}
    />
  );
}
