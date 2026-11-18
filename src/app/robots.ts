import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/marketplace-data";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] }],
    sitemap: `${origin}/sitemap.xml`,
  };
}
