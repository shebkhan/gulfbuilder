import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { EnquiryForm } from "@/components/domain/marketplace/enquiry-form";
import { ListingCard } from "@/components/domain/marketplace/listing-card";
import { ShareButtons } from "@/components/domain/marketplace/share-buttons";
import { Link } from "@/i18n/navigation";
import { formatListingRent } from "@/lib/marketplace";
import {
  getListingImages,
  getPublicListing,
  getPublicListings,
  siteUrl,
} from "@/lib/marketplace-data";
import { listingJsonLd, listingOg } from "@/lib/marketplace-seo";

export const revalidate = 60;

type Spec = { label: string; value: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const [listing, origin] = await Promise.all([getPublicListing(slug), siteUrl()]);
  if (!listing) return {};
  const images = await getListingImages(listing.unit_id);
  const seo = listingOg(listing, `${origin}/${locale}/properties/${slug}`, images[0], locale);
  return {
    metadataBase: new URL(origin),
    title: seo.title,
    description: seo.description,
    alternates: { canonical: `/${locale}/properties/${slug}` },
    openGraph: seo.openGraph,
    twitter: seo.twitter,
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketplace");

  const listing = await getPublicListing(slug);
  if (!listing) notFound();

  const [images, allListings, origin] = await Promise.all([
    getListingImages(listing.unit_id),
    getPublicListings(),
    siteUrl(),
  ]);
  const hero = images[0];
  const related = allListings
    .filter((row) => row.unit_id !== listing.unit_id && row.city === listing.city)
    .slice(0, 3);

  const specs: Spec[] = [];
  if (listing.unit_type) {
    specs.push({ label: t("detail.type"), value: listing.unit_type });
  }
  if (listing.bedrooms !== null) {
    specs.push({ label: t("detail.bedrooms"), value: String(listing.bedrooms) });
  }
  if (listing.bathrooms !== null) {
    specs.push({ label: t("detail.bathrooms"), value: String(listing.bathrooms) });
  }
  if (listing.area_sqm !== null) {
    specs.push({ label: t("detail.area"), value: `${listing.area_sqm} m²` });
  }
  if (listing.furnished) {
    specs.push({ label: t("detail.furnished"), value: t("detail.yes") });
  }
  if (listing.occupancy_type) {
    specs.push({ label: t("detail.occupancy"), value: listing.occupancy_type });
  }

  const jsonLd = listingJsonLd(
    listing,
    `${origin}/${locale}/properties/${listing.slug}`,
    hero,
  );

  const mapUrl =
    listing.latitude !== null && listing.longitude !== null
      ? `https://www.google.com/maps/search/?api=1&query=${listing.latitude},${listing.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.city ?? listing.building_name)}`;

  return (
    <main className="min-h-screen bg-surface px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="mx-auto max-w-6xl">
        <Link href="/properties" className="font-label-md text-label-md text-secondary underline">
          {t("backToResults")}
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">{listing.title}</h1>
            <p className="mt-1 flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
              <MapPin className="size-4" aria-hidden /> {listing.city ?? listing.zone ?? "—"}
            </p>

            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero}
                alt={listing.title}
                className="mt-4 aspect-[16/10] w-full rounded-frame object-cover"
              />
            ) : (
              <div className="mt-4 aspect-[16/10] w-full rounded-frame bg-surface-container" aria-hidden />
            )}
            {images.length > 1 ? (
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {images.map((image) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={image}
                    src={image}
                    alt=""
                    className="size-20 shrink-0 rounded-xl object-cover"
                  />
                ))}
              </div>
            ) : null}

            <div className="mt-6 rounded-frame bg-surface-container-lowest p-5 shadow-canvas">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                {t("detail.about")}
              </h2>
              <p className="mt-2 whitespace-pre-line font-body-md text-body-md text-on-surface-variant">
                {listing.description ?? t("detail.noDescription")}
              </p>
            </div>

            <div className="mt-6 rounded-frame bg-surface-container-lowest p-5 shadow-canvas">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("detail.specs")}</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {specs.map((spec) => (
                  <div key={spec.label} className="rounded-xl bg-surface-container-low p-3">
                    <p className="font-label-sm text-label-sm text-on-surface-variant">{spec.label}</p>
                    <p className="font-body-md text-body-md text-on-surface">{spec.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1 font-label-md text-label-md text-secondary underline"
            >
              <MapPin className="size-4" aria-hidden /> {t("detail.mapLink")}
            </a>

            <div className="mt-6">
              <ShareButtons
                url={`${origin}/${locale}/properties/${listing.slug}`}
                title={listing.title}
              />
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <div className="rounded-frame bg-surface-container-lowest p-5 shadow-canvas">
              <p className="font-headline-md text-headline-md text-primary">
                {formatListingRent(listing, locale)}
              </p>
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                {t("detail.perMonth")}
              </p>
            </div>
            <EnquiryForm
              orgId={listing.org_id}
              unitId={listing.unit_id}
              whatsapp={listing.whatsapp}
              message={t("detail.enquiryMessage", { title: listing.title })}
            />
          </aside>
        </div>

        {related.length > 0 ? (
          <section className="mt-12">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">
              {t("detail.related")}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((row) => (
                <ListingCard
                  key={row.unit_id}
                  listing={row}
                  locale={locale}
                  viewLabel={t("viewDetails")}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
