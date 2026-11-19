import { BedDouble, MapPin, Ruler } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatListingRent } from "@/lib/marketplace";
import type { Database } from "@/types/database";

type Listing = Database["public"]["Views"]["public_listings"]["Row"];

export function ListingCard({
  listing,
  imageUrl,
  locale,
  viewLabel,
}: {
  listing: Listing;
  imageUrl?: string;
  locale: string;
  viewLabel: string;
}) {
  return (
    <article className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm">
      <Link href={`/properties/${listing.slug}`} className="block">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={listing.title} className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="aspect-[4/3] w-full bg-surface-container" aria-hidden />
        )}
        <div className="flex flex-col gap-2 p-4">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">{listing.title}</h3>
          <p className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
            <MapPin className="size-4" aria-hidden /> {listing.city ?? listing.zone ?? "—"}
          </p>
          <div className="flex flex-wrap gap-3 font-body-sm text-body-sm text-on-surface-variant">
            {listing.bedrooms !== null ? (
              <span className="flex items-center gap-1">
                <BedDouble className="size-4" aria-hidden /> {listing.bedrooms}
              </span>
            ) : null}
            {listing.area_sqm !== null ? (
              <span className="flex items-center gap-1">
                <Ruler className="size-4" aria-hidden /> {listing.area_sqm} m²
              </span>
            ) : null}
          </div>
          <p className="font-headline-sm text-headline-sm text-primary">
            {formatListingRent(listing, locale)}
          </p>
          <span className="font-label-md text-label-md text-secondary">{viewLabel}</span>
        </div>
      </Link>
    </article>
  );
}
