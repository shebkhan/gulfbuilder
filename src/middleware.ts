import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";
import { encodeBrand, resolveBrand } from "@/lib/white-label";

const intl = createIntlMiddleware(routing);

/** Route groups `(app)`, `(owner)`, `(portal)` and `(platform)` are all authenticated. */
const PROTECTED = [
  "/dashboard",
  "/onboarding",
  "/mfa",
  "/buildings",
  "/units",
  "/listings",
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
  "/meters",
  "/settings",
  "/portal",
  "/owner",
  "/platform",
];

function splitLocale(pathname: string) {
  const locale =
    routing.locales.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)) ??
    routing.defaultLocale;
  const path = pathname.slice(locale.length + 1) || "/";
  return { locale, path };
}

export default async function middleware(request: NextRequest) {
  const { locale, path } = splitLocale(request.nextUrl.pathname);

  // Rate limiting for sensitive/public endpoints.
  let bucket: { limit: number; windowMs: number } | null = null;
  let bucketName = "";
  if (path === "/login" || path === "/sign-up") {
    bucket = RATE_LIMITS.auth ?? null;
    bucketName = "auth";
  } else if (path.startsWith("/properties")) {
    bucket = RATE_LIMITS.public ?? null;
    bucketName = "public";
  }
  if (bucket) {
    const { ok, retryAfter } = checkRateLimit(`${bucketName}:${clientIp(request)}`, bucket!.limit, bucket!.windowMs);
    if (!ok) {
      return new NextResponse("Too many requests", {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      });
    }
  }

  const response = intl(request);
  const { user } = await updateSession(request, response);

  // White-label: the host decides the organization (SPEC §10).
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const brand = await resolveBrand(host);
  if (brand) {
    response.headers.set("x-middleware-request-x-brand", encodeBrand(brand));
    response.headers.set("x-middleware-request-x-org-id", brand.orgId);
  }

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


const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  auth: { limit: 10, windowMs: 60_000 },
  public: { limit: 60, windowMs: 60_000 },
};

export const config = {
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
