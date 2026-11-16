import { z } from "zod";

export const emailField = z.string().trim().toLowerCase().email();
export const passwordField = z.string().min(8).max(72);

export const signInSchema = z.object({ email: emailField, password: passwordField });
export const signUpSchema = signInSchema.extend({ fullName: z.string().trim().min(2) });
export const resetSchema = z.object({ email: emailField });
export const setPasswordSchema = z.object({ password: passwordField });

export const MARKET_CODES = ["QA", "AE", "SA", "KW", "BH", "OM"] as const;
export const MARKET_CURRENCIES = ["QAR", "AED", "SAR", "KWD", "BHD", "OMR"] as const;

export const createOrgSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, "invalid_slug"),
  countryCode: z.enum(MARKET_CODES),
  baseCurrency: z.enum(MARKET_CURRENCIES),
  locale: z.enum(["en", "ar"]),
});

export type AuthState = { error?: string };
export type OrgState = { error?: string };
