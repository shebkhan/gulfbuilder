import { describe, expect, it } from "vitest";
import {
  filterListings,
  formatListingRent,
  listingSlug,
  parseListingFilters,
  shareUrls,
  whatsappEnquiryUrl,
  type ListingPreview,
} from "./marketplace";

const listing = (overrides: Partial<ListingPreview> = {}): ListingPreview => ({
  title: "Building A 101",
  description: "Bright flat",
  city: "Doha",
  unit_type: "1br",
  bedrooms: 1,
  rent_minor: 350000,
  currency: "QAR",
  ...overrides,
});

describe("listingSlug", () => {
  it("normalises latin text into a slug", () => {
    expect(
      listingSlug({ city: "Doha", building: "Al Nakheel Tower", unitNo: "A-101" }),
    ).toBe("doha-al-nakheel-tower-a-101");
  });

  it("keeps arabic letters and digits instead of producing an empty slug", () => {
    expect(
      listingSlug({ city: "الدوحة", building: "برج النخيل", unitNo: "١٠١" }),
    ).toBe("الدوحة-برج-النخيل-١٠١");
  });

  it("falls back to listing when every part is empty", () => {
    expect(listingSlug({ city: "", building: "***", unitNo: "" })).toBe("listing");
  });
});

describe("parseListingFilters", () => {
  it("returns nulls for an empty query", () => {
    expect(parseListingFilters({})).toEqual({
      city: null,
      type: null,
      bedrooms: null,
      minRentMinor: null,
      maxRentMinor: null,
      query: null,
    });
  });

  it("parses valid values and converts rent into minor units", () => {
    const filters = parseListingFilters({
      city: " Doha ",
      type: "1br",
      bedrooms: "2",
      min: "3000.50",
      max: "5000",
      q: "  near metro  ",
    });
    expect(filters).toEqual({
      city: "Doha",
      type: "1br",
      bedrooms: 2,
      minRentMinor: 300050n,
      maxRentMinor: 500000n,
      query: "near metro",
    });
  });

  it("drops invalid values instead of throwing", () => {
    const filters = parseListingFilters({
      city: "",
      bedrooms: "many",
      min: "abc",
      max: "-5",
      q: "   ",
    });
    expect(filters.bedrooms).toBeNull();
    expect(filters.minRentMinor).toBeNull();
    expect(filters.maxRentMinor).toBeNull();
    expect(filters.city).toBeNull();
    expect(filters.query).toBeNull();
  });

  it("uses the first value when a parameter is repeated", () => {
    expect(parseListingFilters({ city: ["Doha", "Al Rayyan"] }).city).toBe("Doha");
  });
});

describe("filterListings", () => {
  it("matches city, type, bedrooms, rent range and free text", () => {
    const rows = [
      listing(),
      listing({ title: "Building B 201", city: "Al Rayyan", unit_type: "studio", bedrooms: 0 }),
      listing({ title: "Quiet garden flat", rent_minor: 600000 }),
    ];
    const filters = parseListingFilters({
      city: "Doha",
      type: "1br",
      bedrooms: "1",
      min: "3000",
      max: "4000",
      q: "bright",
    });
    expect(filterListings(rows, filters)).toEqual([rows[0]]);
  });

  it("keeps every row when no filter is set", () => {
    const rows = [listing(), listing({ city: null, rent_minor: null })];
    expect(filterListings(rows, parseListingFilters({}))).toEqual(rows);
  });
});

describe("formatListingRent", () => {
  it("formats minor units through the shared money helper", () => {
    expect(formatListingRent(listing())).toBe("QAR 3,500.00");
  });

  it("returns a placeholder when rent is not set", () => {
    expect(formatListingRent(listing({ rent_minor: null }))).toBe("—");
  });
});

describe("whatsappEnquiryUrl", () => {
  it("strips formatting from the phone and encodes the message", () => {
    expect(whatsappEnquiryUrl("+974 (5555) 1234", "Is A-101 free?")).toBe(
      "https://wa.me/97455551234?text=Is%20A-101%20free%3F",
    );
  });
});

describe("shareUrls", () => {
  it("builds the four share targets from the listing URL", () => {
    const urls = shareUrls("https://example.com/en/properties/doha-a-101", "Flat A-101");
    expect(urls).toEqual({
      whatsapp: "https://wa.me/?text=Flat%20A-101%20https%3A%2F%2Fexample.com%2Fen%2Fproperties%2Fdoha-a-101",
      x: "https://x.com/intent/tweet?text=Flat%20A-101&url=https%3A%2F%2Fexample.com%2Fen%2Fproperties%2Fdoha-a-101",
      facebook: "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fexample.com%2Fen%2Fproperties%2Fdoha-a-101",
      copy: "https://example.com/en/properties/doha-a-101",
    });
  });
});
