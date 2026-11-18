import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketPackForm } from "@/components/domain/market-pack-form";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function PlatformMarketPacks({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("platform");

  const admin = createSupabaseAdminClient();
  const { data: packs } = await admin.from("market_packs").select("*").order("country_code");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-headline-md text-headline-md text-on-surface">{t("marketPack.title")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("marketPack.subtitle")}</p>
      </div>

      {(packs ?? []).map((pack) => (
        <MarketPackForm
          key={`${pack.country_code}-${pack.effective_from}`}
          initial={{
            countryCode: pack.country_code,
            effectiveFrom: pack.effective_from,
            version: pack.version,
            rules: pack.rules,
          }}
        />
      ))}

      <MarketPackForm />
    </div>
  );
}
