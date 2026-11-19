import { describe, expect, it } from "vitest";
import { listingEnquirySchema } from "./marketplace";

const valid = {
  orgId: "11111111-1111-1111-1111-111111111111",
  unitId: "22222222-2222-2222-2222-222222222222",
  name: "Fatima",
  email: "fatima@example.com",
  message: "Is this flat still available next month?",
};

describe("listingEnquirySchema", () => {
  it("accepts a complete enquiry", () => {
    expect(listingEnquirySchema.safeParse(valid).success).toBe(true);
  });

  it("requires a unit and organisation", () => {
    const result = listingEnquirySchema.safeParse({ ...valid, unitId: "nope" });
    expect(result.success).toBe(false);
  });

  it("rejects a short message and a malformed email", () => {
    expect(listingEnquirySchema.safeParse({ ...valid, message: "Hi" }).success).toBe(false);
    expect(listingEnquirySchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("allows a blank optional phone", () => {
    expect(listingEnquirySchema.safeParse({ ...valid, phone: "" }).success).toBe(true);
  });
});
