import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `next dev` and `next build` share one output folder, so a build while a dev server is
  // running leaves the dev server with a stale route manifest. NEXT_DIST_DIR keeps them apart.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-label",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-select",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-tabs",
    ],
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default withNextIntl(nextConfig);
