import { z } from "zod";

export const uploadSchema = z.object({
  entityType: z.enum(["lease", "tenant", "building", "unit", "vendor", "inspection"], {
    message: "validation.required",
  }),
  entityId: z.string().min(1, "validation.required").uuid("validation.invalidUuid"),
  kind: z.enum(["contract", "id_card", "trade_license", "title_deed", "photo", "receipt"], {
    message: "validation.required",
  }),
  expiresOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "validation.invalidDate")
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(500, "validation.tooLong").optional().or(z.literal("")),
});
