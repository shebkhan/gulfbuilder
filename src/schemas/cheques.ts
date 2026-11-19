import { z } from "zod";

export const parsedChequeSchema = z.object({
  chequeNo: z.string().trim().max(50).nullable().optional().transform((v) => v ?? null),
  bankName: z.string().trim().max(100).nullable().optional().transform((v) => v ?? null),
  amount: z.string().trim().max(30).nullable().optional().transform((v) => v ?? null),
  chequeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  payee: z.string().trim().max(200).nullable().optional().transform((v) => v ?? null),
});

export type ParsedCheque = z.infer<typeof parsedChequeSchema>;

export const registerChequeSchema = z.object({
  tenantId: z.string().uuid("validation.invalidUuid"),
  leaseId: z.string().uuid("validation.invalidUuid"),
  chequeNo: z.string().trim().min(1, "validation.required").max(50, "validation.tooLong"),
  bankName: z.string().trim().min(1, "validation.required").max(100, "validation.tooLong"),
  amount: z.string().min(1, "validation.required"),
  currency: z.string().length(3, "validation.invalidInput").default("QAR"),
  chequeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "validation.invalidDate"),
  notes: z.string().trim().max(500, "validation.tooLong").optional().or(z.literal("")),
  imagePath: z.string().trim().max(500).optional().or(z.literal("")),
  payeeRaw: z.string().trim().max(200).optional().or(z.literal("")),
});

export const replaceChequeSchema = z.object({
  oldChequeId: z.string().uuid("validation.invalidUuid"),
  chequeNo: z.string().trim().min(1, "validation.required").max(50, "validation.tooLong"),
  bankName: z.string().trim().min(1, "validation.required").max(100, "validation.tooLong"),
  amount: z.string().min(1, "validation.required"),
  currency: z.string().length(3, "validation.invalidInput").default("QAR"),
  chequeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "validation.invalidDate"),
  notes: z.string().trim().max(500, "validation.tooLong").optional().or(z.literal("")),
  imagePath: z.string().trim().max(500).optional().or(z.literal("")),
  payeeRaw: z.string().trim().max(200).optional().or(z.literal("")),
});
