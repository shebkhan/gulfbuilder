import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { routing } from "@/i18n/routing";
import { applyTerminology, decodeBrand } from "@/lib/white-label";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const messages = (await import(`../../messages/${locale}.json`)).default;

  // Terminology overrides come from the organization that owns the request host.
  let terminology: Record<string, string> | null = null;
  try {
    const header = await headers();
    terminology = decodeBrand(header.get("x-brand"))?.terminology ?? null;
  } catch {
    terminology = null;
  }

  return {
    locale,
    messages: applyTerminology(messages, terminology),
  };
});
