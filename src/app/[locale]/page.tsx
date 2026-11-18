import { getTranslations, setRequestLocale } from "next-intl/server";
import { Building2 } from "lucide-react";
import { ListingCard } from "@/components/domain/marketplace/listing-card";
import { ListingSearch } from "@/components/domain/marketplace/listing-search";
import { Link } from "@/i18n/navigation";
import { getCities, getListingImages, getPublicListings } from "@/lib/marketplace-data";

export const revalidate = 60;

export default async function MarketplaceLanding({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketplace");

  const [listings, cities] = await Promise.all([getPublicListings(), getCities()]);
  const featured = listings.slice(0, 6);
  const images = await Promise.all(
    featured.map(async (listing) => (await getListingImages(listing.unit_id))[0]),
  );

  return (
    <main className="min-h-screen bg-surface">
      <header className="border-b border-hairline bg-surface-container-lowest">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2 font-headline-sm text-headline-sm text-on-surface">
            <Building2 className="size-5 text-primary" aria-hidden />
            {t("brand")}
          </Link>
          <Link href="/dashboard" className="font-label-md text-label-md text-secondary underline">
            {t("dashboard")}
          </Link>
        </div>
      </header>

      <section className="bg-surface-container-low px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="font-section-kicker text-section-kicker text-secondary">{t("kicker")}</p>
          <h1 className="mt-2 font-display-lg text-display-lg text-on-surface">{t("hero")}</h1>
          <p className="mt-3 max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
            {t("subtitle")}
          </p>
          <div className="mt-8 rounded-frame bg-surface-container-lowest p-5 shadow-canvas">
            <ListingSearch
              locale={locale}
              cities={cities}
              labels={{
                keywords: t("filters.keywords"),
                city: t("filters.city"),
                type: t("filters.type"),
                bedrooms: t("filters.bedrooms"),
                min: t("filters.min"),
                max: t("filters.max"),
                all: t("filters.all"),
                search: t("filters.search"),
              }}
            />
          </div>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">{t("featured")}</h2>
            <Link href="/properties" className="font-label-md text-label-md text-secondary underline">
              {t("viewAll")}
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((listing, index) => (
              <ListingCard
                key={listing.unit_id}
                listing={listing}
                imageUrl={images[index]}
                locale={locale}
                viewLabel={t("viewDetails")}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <p className="font-body-lg text-body-lg text-on-surface-variant">{t("noListings")}</p>
        </section>
      )}

      {cities.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <h2 className="font-headline-lg text-headline-lg text-on-surface">{t("browseByCity")}</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {cities.map((city) => (
              <Link
                key={city}
                href={`/properties?city=${encodeURIComponent(city)}`}
                className="rounded-full border border-hairline bg-surface-container-lowest px-4 py-2 font-label-md text-label-md text-on-surface hover:bg-surface-container-high"
              >
                {city}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
