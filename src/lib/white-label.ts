import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * White-label resolution (SPEC §10): the request host decides which organization the
 * app belongs to. The middleware resolves it once per host and passes the branding to
 * the layout through the `x-brand` request header.
 */

export type Brand = {
  orgId: string;
  slug: string;
  appName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  fontFamily: string | null;
  terminology: Record<string, string>;
  customDomain: string | null;
};

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; brand: Brand | null }>();

/** Host that serves the `{slug}.{appHost}` form, e.g. `localhost` in development. */
export function appHost(): string {
  return process.env.NEXT_PUBLIC_APP_HOST ?? "localhost";
}

function client() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function resolveBrand(host: string): Promise<Brand | null> {
  const clean = host.split(":")[0]?.toLowerCase() ?? "";
  if (!clean) return null;

  const cached = cache.get(clean);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.brand;

  let brand: Brand | null = null;
  try {
    const { data, error } = await client().rpc("resolve_org_by_host", {
      p_host: clean,
      p_app_host: appHost(),
    });
    if (!error && data) brand = data as Brand;
  } catch {
    brand = null;
  }

  cache.set(clean, { at: Date.now(), brand });
  return brand;
}

/** Base64url so the branding travels through a header safely. */
export function encodeBrand(brand: Brand): string {
  const json = JSON.stringify(brand);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeBrand(value: string | null | undefined): Brand | null {
  if (!value) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Brand;
  } catch {
    return null;
  }
}

/** Branding for the current request, resolved by middleware from the host. */
export async function getBrand(): Promise<Brand | null> {
  try {
    return decodeBrand((await headers()).get("x-brand"));
  } catch {
    // Static prerendering has no request headers.
    return null;
  }
}

/**
 * Terminology overrides (SPEC §10): a flat map of dotted message keys to replacements,
 * merged over the base translations. Unknown keys are ignored so a typo cannot invent
 * new strings.
 */
export function applyTerminology(
  messages: Record<string, unknown>,
  terminology: Record<string, string> | null | undefined,
): Record<string, unknown> {
  if (!terminology || Object.keys(terminology).length === 0) return messages;

  const copy = JSON.parse(JSON.stringify(messages)) as Record<string, unknown>;
  for (const [path, value] of Object.entries(terminology)) {
    const segments = path.split(".");
    let node: Record<string, unknown> | undefined = copy;
    for (const [index, segment] of segments.entries()) {
      if (!node || typeof node !== "object") {
        node = undefined;
        break;
      }
      if (index === segments.length - 1) {
        if (segment in node) node[segment] = value;
      } else {
        node = node[segment] as Record<string, unknown> | undefined;
      }
    }
  }
  return copy;
}
