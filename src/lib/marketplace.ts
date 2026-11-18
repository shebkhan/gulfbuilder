import { formatMoney, toMinor } from "./money";

export type ListingPreview = {
  title: string | null;
  description: string | null;
  city: string | null;
  unit_type: string | null;
  bedrooms: number | null;
  rent_minor: number | null;
  currency: string | null;
};

export type ListingFilters = {
  city: string | null;
  type: string | null;
  bedrooms: number | null;
  minRentMinor: bigint | null;
  maxRentMinor: bigint | null;
  query: string | null;
};

type QueryValue = string | string[] | undefined;

function first(value: QueryValue): string | null {
  const text = Array.isArray(value) ? value[0] : value;
  const trimmed = text?.trim();
  return trimmed ? trimmed : null;
}

export function listingSlug(parts: { city?: string | null; building?: string | null; unitNo?: string | null }): string {
  const slug = [parts.city, parts.building, parts.unitNo]
    .map((part) =>
      (part ?? "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean)
    .join("-");
  return slug || "listing";
}

export function parseListingFilters(params: Record<string, QueryValue>, currency = "QAR"): ListingFilters {
  const rent = (value: QueryValue): bigint | null => {
    const text = first(value);
    if (!text || !/^\d+(?:\.\d+)?$/.test(text)) return null;
    try {
      const minor = toMinor(text, currency);
      return minor > 0n ? minor : null;
    } catch {
      return null;
    }
  };
  const bedrooms = first(params.bedrooms);
  const parsedBedrooms = bedrooms && /^\d+$/.test(bedrooms) ? Number(bedrooms) : null;

  return {
    city: first(params.city),
    type: first(params.type),
    bedrooms: parsedBedrooms,
    minRentMinor: rent(params.min),
    maxRentMinor: rent(params.max),
    query: first(params.q),
  };
}

export function filterListings<T extends ListingPreview>(listings: T[], filters: ListingFilters): T[] {
  return listings.filter((row) => {
    if (filters.city && row.city !== filters.city) return false;
    if (filters.type && row.unit_type !== filters.type) return false;
    if (filters.bedrooms !== null && row.bedrooms !== filters.bedrooms) return false;
    if (row.rent_minor === null) {
      if (filters.minRentMinor !== null || filters.maxRentMinor !== null) return false;
    } else {
      const rent = BigInt(row.rent_minor);
      if (filters.minRentMinor !== null && rent < filters.minRentMinor) return false;
      if (filters.maxRentMinor !== null && rent > filters.maxRentMinor) return false;
    }
    if (filters.query) {
      const needle = filters.query.toLowerCase();
      const haystack = `${row.title ?? ""} ${row.description ?? ""}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

export function formatListingRent(row: Pick<ListingPreview, "rent_minor" | "currency">, locale = "en"): string {
  if (row.rent_minor === null || row.rent_minor === undefined) return "—";
  return formatMoney(BigInt(row.rent_minor), row.currency ?? "QAR", locale);
}

export function whatsappEnquiryUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

export function shareUrls(url: string, title: string) {
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    x: `https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    copy: url,
  };
}
