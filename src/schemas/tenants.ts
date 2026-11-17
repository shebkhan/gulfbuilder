import { z } from "zod";

export const tenantSchema = z.object({
  fullName: z.string().trim().min(1, "validation.required").max(120, "validation.tooLong"),
  kind: z.enum(["person", "company"]).default("person"),
  language: z.enum(["ar", "en"]).default("ar"),
  idNumber: z
    .string()
    .trim()
    .min(4, "validation.tooShort")
    .max(30, "validation.tooLong")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(30, "validation.tooLong").optional().or(z.literal("")),
  whatsapp: z.string().trim().max(30, "validation.tooLong").optional().or(z.literal("")),
  email: z.string().trim().email("validation.invalidEmail").optional().or(z.literal("")),
  nationality: z.string().trim().max(60, "validation.tooLong").optional().or(z.literal("")),
  employer: z.string().trim().max(120, "validation.tooLong").optional().or(z.literal("")),
});
