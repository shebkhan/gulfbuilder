import { z } from "zod";

export const listingEnquirySchema = z.object({
  orgId: z.string().uuid("validation.invalidUuid"),
  unitId: z.string().uuid("validation.invalidUuid"),
  name: z.string().trim().min(2, "validation.required").max(120, "validation.tooLong"),
  email: z.string().trim().email("validation.invalidEmail"),
  phone: z.string().trim().max(40, "validation.tooLong").optional().or(z.literal("")),
  message: z.string().trim().min(5, "validation.required").max(2000, "validation.tooLong"),
});

export type ListingEnquiry = z.infer<typeof listingEnquirySchema>;
