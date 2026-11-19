import type { Metadata } from "next";
import { formatListingRent, type ListingPreview } from "./marketplace";
import { exponentOf } from "./money";

/** Major-unit price for schema.org (money is stored in minor units). */
export function majorPrice(minor: number, currency: string): number {
  return Number(minor) / 10 ** exponentOf(currency);
}

export function listingJsonLd(
  listing: Pick<ListingPreview, "title" | "description" | "city" | "rent_minor" | "currency">,
  url = "",
  image?: string,
) {
  const currency = listing.currency ?? "QAR";
  return {
    "@context": "https://schema.org",
    "@type": "Residence",
    name: listing.title ?? undefined,
    description: listing.description ?? undefined,
    image: image ? [image] : [],
    url,
    address: listing.city
      ? { "@type": "PostalAddress", addressLocality: listing.city }
      : undefined,
    offers:
      listing.rent_minor !== null
        ? {
            "@type": "Offer",
            price: majorPrice(listing.rent_minor, currency),
            priceCurrency: currency,
            availability: "https://schema.org/InStock",
          }
        : undefined,
  };
}

export function listingOg(
  listing: Pick<ListingPreview, "title" | "description" | "city" | "rent_minor" | "currency">,
  url: string,
  image: string | undefined,
  locale: string,
) {
  const title = listing.title ?? "Listing";
  const price = formatListingRent(listing, locale);
  const description =
    listing.description ?? `${title}${listing.city ? ` in ${listing.city}` : ""}`;
  const images = image ? [image] : [];
  const openGraph: Metadata["openGraph"] = {
    type: "website",
    url,
    title: price === "—" ? title : `${title} — ${price}`,
    description,
    images,
    locale,
  };
  const twitter: Metadata["twitter"] = {
    card: "summary_large_image",
    title: openGraph.title as string,
    description,
    images,
  };
  return { title: openGraph.title as string, description, openGraph, twitter };
}
