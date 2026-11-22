import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Inter, Manrope, Noto_Sans_Arabic } from "next/font/google";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { ServiceWorkerRegistrar } from "@/components/domain/service-worker-registrar";
import { applyTerminology, getBrand } from "@/lib/white-label";
import "../globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const arabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });

  return {
    title: `${t("appName")} — ${t("appTagline")}`,
    description: t("appName"),
    manifest: "/manifest.webmanifest",
    icons: { icon: "/icons/icon.svg" },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // White-label branding (SPEC §10): the middleware resolved the organization from the
  // request host and passed its branding along in the `x-brand` header.
  const brand = await getBrand();
  const messages = applyTerminology(await getMessages(), brand?.terminology);

  const brandStyle = brand
    ? ({
        "--brand-primary": brand.primaryColor ?? undefined,
        "--brand-secondary": brand.secondaryColor ?? undefined,
        "--brand-font": brand.fontFamily ?? undefined,
      } as React.CSSProperties)
    : undefined;

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${manrope.variable} ${inter.variable} ${arabic.variable}`}
      style={brandStyle}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <a href="#main-content" className="skip-to-content">
            Skip to content
          </a>
          <ServiceWorkerRegistrar />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
