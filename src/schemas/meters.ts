import { z } from "zod";

export const meterSchema = z.object({
  kind: z.enum(["electricity", "water", "gas"], { message: "validation.required" }),
  buildingId: z.string().min(1, "validation.required").uuid("validation.invalidUuid"),
  unitId: z.string().uuid("validation.invalidUuid").optional().or(z.literal("")),
  meterNo: z.string().trim().min(1, "validation.required").max(60, "validation.tooLong"),
});

export const readingSchema = z.object({
  meterId: z.string().min(1, "validation.required").uuid("validation.invalidUuid"),
  readOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "validation.invalidDate"),
  value: z.string().min(1, "validation.required"),
});
