import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getPublicListings, siteUrl } from "@/lib/marketplace-data";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [origin, listings] = await Promise.all([siteUrl(), getPublicListings()]);
  const now = new Date();

  const staticRoutes = routing.locales.flatMap((locale) => [
    {
      url: `${origin}/${locale}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 1,
    },
    {
      url: `${origin}/${locale}/properties`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    },
  ]);

  const listingRoutes = listings.flatMap((listing) =>
    routing.locales.map((locale) => ({
      url: `${origin}/${locale}/properties/${listing.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  );

  return [...staticRoutes, ...listingRoutes];
}
