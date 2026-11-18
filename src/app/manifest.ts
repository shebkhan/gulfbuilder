import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { resolveBrand } from "@/lib/white-label";

/** PWA manifest (SPEC §10, v1 surfaces). The name and colours follow the branding. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const brand = await resolveBrand(host);

  return {
    name: brand?.appName ?? "Gulf Property",
    short_name: brand?.appName ?? "Gulf",
    description: "Property management for the Gulf",
    start_url: "/en/dashboard",
    display: "standalone",
    background_color: brand?.secondaryColor ?? "#fcf9f5",
    theme_color: brand?.primaryColor ?? "#795919",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: brand?.logoUrl ?? "/icons/icon.svg",
        sizes: "any",
        purpose: "any",
      },
    ],
  };
}
