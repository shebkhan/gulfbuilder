import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intl = createIntlMiddleware(routing);

/** Route groups `(app)`, `(owner)`, `(portal)` and `(platform)` are all authenticated. */
const PROTECTED = [
  "/dashboard",
  "/onboarding",
  "/mfa",
  "/buildings",
  "/units",
  "/owners",
  "/tenants",
  "/leases",
  "/payments",
  "/cheques",
  "/deposits",
  "/expenses",
  "/maintenance",
  "/reports",
  "/documents",
  "/settings",
];

function splitLocale(pathname: string) {
  const locale =
    routing.locales.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)) ??
    routing.defaultLocale;
  const path = pathname.slice(locale.length + 1) || "/";
  return { locale, path };
}

export default async function middleware(request: NextRequest) {
  const response = intl(request);
  const { user } = await updateSession(request, response);

  const { locale, path } = splitLocale(request.nextUrl.pathname);
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Signed-in users never need the auth screens.
  if (user && (path === "/login" || path === "/sign-up")) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/dashboard`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
