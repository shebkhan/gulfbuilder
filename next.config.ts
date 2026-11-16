import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `next dev` and `next build` share one output folder, so a build while a dev server is
  // running leaves the dev server with a stale route manifest. NEXT_DIST_DIR keeps them apart.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default withNextIntl(nextConfig);
