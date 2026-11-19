import { z } from "zod";

export const LOOKUP_CATEGORIES = [
  "unit_type",
  "expense_category",
  "maintenance_category",
  "payment_method_label",
  "charge_type_label",
] as const;

const LABEL_CODES: Partial<Record<(typeof LOOKUP_CATEGORIES)[number], readonly string[]>> = {
  payment_method_label: ["cash", "bank_transfer", "cheque", "card", "online"],
  charge_type_label: ["rent", "deposit", "utility", "maintenance", "late_fee", "other"],
};

export const lookupSchema = z
  .object({
    orgId: z.string().uuid(),
    category: z.enum(LOOKUP_CATEGORIES),
    code: z.string().trim().min(1).max(60),
    label: z.string().trim().min(1).max(120),
    sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    const allowed = LABEL_CODES[value.category];
    if (allowed && !allowed.includes(value.code)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["code"],
        message: "invalid_code",
      });
    }
  });

export const integrationSchema = z.object({
  provider: z.enum(["telegram", "whatsapp"]),
  botToken: z.string().trim().max(300).default(""),
  botName: z.string().trim().max(80).default(""),
  chatId: z.string().trim().max(80).default(""),
  phone: z.string().trim().max(40).default(""),
  enabled: z.boolean().default(false),
});
