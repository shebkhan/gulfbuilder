import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/components/domain/auth-form";
import { Link } from "@/i18n/navigation";
import { signInAction } from "@/server/actions/auth";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-md text-headline-md text-on-surface">{t("signIn")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("signInSubtitle")}</p>
      </div>

      <AuthForm
        action={signInAction}
        hidden={{ locale }}
        pendingLabel={(await getTranslations("common"))("loading")}
        submitLabel={t("signIn")}
        errorMessages={t.raw("errors") as Record<string, string>}
        fields={[
          { name: "email", label: t("email"), type: "email", autoComplete: "email" },
          {
            name: "password",
            label: t("password"),
            type: "password",
            autoComplete: "current-password",
          },
        ]}
        footer={
          <div className="flex flex-col gap-2 pt-1 text-center font-body-sm text-body-sm">
            <Link href="/reset-password" className="text-primary hover:underline">
              {t("forgot")}
            </Link>
            <span className="text-on-surface-variant">
              {t("noAccount")}{" "}
              <Link href="/sign-up" className="font-medium text-primary hover:underline">
                {t("signUp")}
              </Link>
            </span>
          </div>
        }
      />
    </div>
  );
}
