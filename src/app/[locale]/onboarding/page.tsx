import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OrgForm } from "@/components/domain/org-form";
import { MARKET_CODES, MARKET_CURRENCIES } from "@/schemas/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // Already a member somewhere: onboarding is done.
  const { count } = await supabase
    .from("org_members")
    .select("org_id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (count) redirect(`/${locale}/dashboard`);

  const t = await getTranslations("onboarding");
  const tc = await getTranslations("common");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-container-low p-margin-mobile lg:p-margin">
      <div className="w-full max-w-xl rounded-frame bg-surface-container-lowest p-space-xl shadow-canvas">
        <h1 className="font-headline-md text-headline-md text-on-surface">{t("title")}</h1>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{t("subtitle")}</p>
        <div className="mt-space-lg">
          <OrgForm
            locale={locale}
            pendingLabel={tc("loading")}
            labels={{
              orgName: t("orgName"),
              slug: t("slug"),
              market: t("market"),
              currency: t("currency"),
              create: t("create"),
            }}
            markets={MARKET_CODES.map((code) => ({
              value: code,
              label: t(
                (
                  {
                    QA: "qatar",
                    AE: "uae",
                    SA: "saudi",
                    KW: "kuwait",
                    BH: "bahrain",
                    OM: "oman",
                  } as const
                )[code],
              ),
            }))}
            currencies={[...MARKET_CURRENCIES]}
          />
        </div>
      </div>
    </div>
  );
}
