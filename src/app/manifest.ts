import type { MetadataRoute } from "next";

/** PWA manifest (SPEC §10, v1 surfaces). The name and colours follow the branding. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gulf Property",
    short_name: "Gulf",
    description: "Property management for the Gulf",
    start_url: "/en/dashboard",
    display: "standalone",
    background_color: "#fcf9f5",
    theme_color: "#795919",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
