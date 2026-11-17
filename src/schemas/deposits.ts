import { z } from "zod";

export const deductionSchema = z.object({
  depositId: z.string().uuid("validation.invalidUuid"),
  amount: z.string().min(1, "validation.required"),
  currency: z.string().length(3, "validation.invalidInput").default("QAR"),
  reason: z.string().trim().min(1, "validation.required").max(300, "validation.tooLong"),
  chargeId: z.string().uuid("validation.invalidUuid").optional().or(z.literal("")),
});

export const refundSchema = z.object({
  depositId: z.string().uuid("validation.invalidUuid"),
  amount: z.string().min(1, "validation.required"),
  currency: z.string().length(3, "validation.invalidInput").default("QAR"),
  reason: z.string().trim().max(300, "validation.tooLong").optional().or(z.literal("")),
});
