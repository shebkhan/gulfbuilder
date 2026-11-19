import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ListingCard } from "@/components/domain/marketplace/listing-card";
import { ListingSearch } from "@/components/domain/marketplace/listing-search";
import { Link } from "@/i18n/navigation";
import { filterListings, parseListingFilters } from "@/lib/marketplace";
import { citiesFrom, getListingImages, getPublicListings, siteUrl } from "@/lib/marketplace-data";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketplace" });
  return {
    metadataBase: new URL(await siteUrl()),
    title: t("resultsTitle"),
    description: t("subtitle"),
    alternates: { canonical: `/${locale}/properties` },
  };
}

type QueryValue = string | string[] | undefined;
type SearchParams = Promise<Record<string, QueryValue>>;

export default async function PropertiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketplace");
  const query = await searchParams;

  const allListings = await getPublicListings();
  const cities = citiesFrom(allListings);
  const filters = parseListingFilters(query);
  const listings = filterListings(allListings, filters);
  const images = await Promise.all(
    listings.map(async (listing) => (await getListingImages(listing.unit_id!))[0]),
  );

  const first = (value: QueryValue) => (Array.isArray(value) ? value[0] : value) ?? "";
  const bedrooms = first(query.bedrooms);

  return (
    <main className="min-h-screen bg-surface px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="font-label-md text-label-md text-secondary underline">
          {t("home")}
        </Link>
        <h1 className="mt-4 font-headline-lg text-headline-lg text-on-surface">
          {t("resultsTitle")}
        </h1>

        <div className="mt-6 rounded-frame bg-surface-container-lowest p-5 shadow-canvas">
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
            values={{
              q: filters.query,
              city: filters.city,
              type: filters.type,
              bedrooms,
              min: first(query.min),
              max: first(query.max),
            }}
          />
        </div>

        <p className="mt-6 font-body-sm text-body-sm text-on-surface-variant">
          {t("resultsCount", { count: listings.length })}
        </p>

        {listings.length > 0 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing, index) => (
              <ListingCard
                key={listing.unit_id}
                listing={listing}
                imageUrl={images[index]}
                locale={locale}
                viewLabel={t("viewDetails")}
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 font-body-lg text-body-lg text-on-surface-variant">
            {t("noResults")}
          </p>
        )}
      </div>
    </main>
  );
}
