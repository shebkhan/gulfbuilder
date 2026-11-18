import { describe, expect, it } from "vitest";
import { listingJsonLd, listingOg } from "./marketplace-seo";

const listing = {
  title: "Doha flat",
  description: "Bright flat near the metro",
  city: "Doha",
  rent_minor: 350000,
  currency: "QAR",
};

describe("listingJsonLd", () => {
  it("describes a Residence with an Offer", () => {
    const ld = listingJsonLd(listing, "https://example.com/en/properties/doha", "https://example.com/a.jpg");
    expect(ld).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Residence",
      name: "Doha flat",
      description: "Bright flat near the metro",
      image: ["https://example.com/a.jpg"],
      url: "https://example.com/en/properties/doha",
      address: { "@type": "PostalAddress", addressLocality: "Doha" },
      offers: {
        "@type": "Offer",
        price: 3500,
        priceCurrency: "QAR",
        availability: "https://schema.org/InStock",
      },
    });
  });

  it("omits the offer when rent is unknown and falls back to an empty image list", () => {
    const ld = listingJsonLd({ ...listing, rent_minor: null, description: null });
    expect(ld.offers).toBeUndefined();
    expect(ld.image).toEqual([]);
    expect(ld.description).toBeUndefined();
  });
});

describe("listingOg", () => {
  it("puts price, image and card type into OG and Twitter cards", () => {
    const og = listingOg(listing, "https://example.com/en/properties/doha", "https://example.com/a.jpg", "en");
    expect(og.title).toBe("Doha flat — QAR 3,500.00");
    expect(og.description).toBe("Bright flat near the metro");
    expect(og.openGraph).toMatchObject({
      type: "website",
      url: "https://example.com/en/properties/doha",
      images: ["https://example.com/a.jpg"],
    });
    expect(og.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["https://example.com/a.jpg"],
    });
  });

  it("falls back to a title-based description when there is none", () => {
    const og = listingOg({ ...listing, description: null }, "https://example.com/p", undefined, "en");
    expect(og.description).toContain("Doha flat");
    expect(og.openGraph).toMatchObject({ images: [] });
  });
});
