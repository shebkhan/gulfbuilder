import { z } from "zod";

export const organizationSchema = z.object({
  name: z.string().trim().min(2, "validation.tooShort").max(120, "validation.tooLong"),
  legalName: z.string().trim().max(120, "validation.tooLong").optional().or(z.literal("")),
  taxId: z.string().trim().max(60, "validation.tooLong").optional().or(z.literal("")),
  baseCurrency: z.enum(["QAR", "AED", "SAR", "KWD", "BHD", "OMR"], {
    message: "validation.required",
  }),
  defaultLocale: z.enum(["en", "ar"], { message: "validation.required" }),
  timezone: z.string().trim().min(1, "validation.required").max(60, "validation.tooLong"),
  graceDays: z
    .coerce.number()
    .int("validation.invalidInput")
    .min(0, "validation.invalidRange")
    .max(90, "validation.invalidRange"),
  lateFee: z.string().min(1, "validation.required"),
  lateFeeType: z.enum(["flat", "percent"], { message: "validation.required" }),
  lateFeePercent: z
    .coerce.number()
    .min(0, "validation.invalidRange")
    .max(100, "validation.invalidRange"),
  taxRate: z
    .coerce.number()
    .min(0, "validation.invalidRange")
    .max(100, "validation.invalidRange"),
  reminderDays: z
    .coerce.number()
    .int("validation.invalidInput")
    .min(0, "validation.invalidRange")
    .max(60, "validation.invalidRange"),
  revenueRecognition: z.enum(["on_due", "straight_line_monthly"], {
    message: "validation.required",
  }),
});

const brandingUrl = z
  .string()
  .trim()
  .max(300, "validation.tooLong")
  .refine((value) => {
    if (value === "") return true;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "invalid_url")
  .optional();

export const brandingSchema = z.object({
  appName: z.string().trim().max(80, "validation.tooLong").optional().or(z.literal("")),
  logoUrl: brandingUrl,
  faviconUrl: brandingUrl,
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "invalid_color")
    .optional()
    .or(z.literal("")),
  secondaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "invalid_color")
    .optional()
    .or(z.literal("")),
  fontFamily: z.string().trim().max(80, "validation.tooLong").optional().or(z.literal("")),
  terminology: z.string().optional().or(z.literal("")),
  customDomain: z.string().trim().max(200, "validation.tooLong").optional().or(z.literal("")),
});

export const templateSchema = z.object({
  event: z.string().trim().min(2, "validation.tooShort").max(60, "validation.tooLong"),
  channel: z.enum(["email", "sms", "telegram", "push"], { message: "validation.required" }),
  locale: z.enum(["en", "ar"], { message: "validation.required" }),
  subject: z.string().trim().max(160, "validation.tooLong").optional().or(z.literal("")),
  body: z.string().trim().min(1, "validation.required").max(4000, "validation.tooLong"),
});
