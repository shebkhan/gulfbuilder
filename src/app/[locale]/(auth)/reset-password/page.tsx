import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/components/domain/auth-form";
import { resetPasswordAction } from "@/server/actions/auth";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const tc = await getTranslations("common");

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-md text-headline-md text-on-surface">{t("resetPassword")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("resetSubtitle")}</p>
      </div>

      <AuthForm
        action={resetPasswordAction}
        hidden={{ locale }}
        pendingLabel={tc("loading")}
        submitLabel={t("sendResetLink")}
        errorMessages={t.raw("errors") as Record<string, string>}
        fields={[{ name: "email", label: t("email"), type: "email", autoComplete: "email" }]}
      />
    </div>
  );
}
