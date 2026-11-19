import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import type { Database } from "@/types/database";

export type Listing = Database["public"]["Views"]["public_listings"]["Row"];

/** Anonymous client: reads go through the RLS-protected public_listings view. */
function publicClient() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getPublicListings(): Promise<Listing[]> {
  const { data, error } = await publicClient()
    .from("public_listings")
    .select("*")
    .order("title");
  if (error) throw new Error(`public_listings: ${error.message}`);
  return data ?? [];
}

export async function getPublicListing(slug: string): Promise<Listing | null> {
  const { data, error } = await publicClient()
    .from("public_listings")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`public_listings: ${error.message}`);
  return data ?? null;
}

export function listingImageUrl(path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/listing-images/${path}`;
}

export async function getListingImages(unitId: string): Promise<string[]> {
  const { data, error } = await publicClient()
    .from("listing_images")
    .select("path")
    .eq("unit_id", unitId)
    .order("sort_order");
  if (error) throw new Error(`listing_images: ${error.message}`);
  return (data ?? []).map((row) => listingImageUrl(row.path));
}

export function citiesFrom(listings: Listing[]): string[] {
  return [...new Set(listings.map((l) => l.city).filter((c): c is string => Boolean(c)))].sort();
}

/** Absolute origin for share links and SEO metadata (derived per request). */
export async function siteUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}
