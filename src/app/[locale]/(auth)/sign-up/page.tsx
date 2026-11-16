import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/components/domain/auth-form";
import { Link } from "@/i18n/navigation";
import { signUpAction } from "@/server/actions/auth";

export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const tc = await getTranslations("common");

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-md text-headline-md text-on-surface">{t("signUp")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("signUpSubtitle")}</p>
      </div>

      <AuthForm
        action={signUpAction}
        hidden={{ locale }}
        pendingLabel={tc("loading")}
        submitLabel={t("signUp")}
        errorMessages={t.raw("errors") as Record<string, string>}
        fields={[
          { name: "fullName", label: t("fullName"), type: "text", autoComplete: "name" },
          { name: "email", label: t("email"), type: "email", autoComplete: "email" },
          {
            name: "password",
            label: t("password"),
            type: "password",
            autoComplete: "new-password",
          },
        ]}
        footer={
          <p className="pt-1 text-center font-body-sm text-body-sm text-on-surface-variant">
            {t("haveAccount")}{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t("signIn")}
            </Link>
          </p>
        }
      />
    </div>
  );
}
