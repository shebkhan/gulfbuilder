import { z } from "zod";

export const recordPaymentSchema = z.object({
  tenantId: z.string().uuid("validation.invalidUuid"),
  leaseId: z.string().uuid("validation.invalidUuid").optional().or(z.literal("")),
  amount: z.string().min(1, "validation.required"),
  currency: z.string().length(3, "validation.invalidInput").default("QAR"),
  method: z.enum(["cash", "bank_transfer", "cheque", "card", "online"], {
    message: "validation.required",
  }),
  receivedAt: z.string().min(1, "validation.required"),
  reference: z.string().trim().max(100, "validation.tooLong").optional().or(z.literal("")),
  notes: z.string().trim().max(500, "validation.tooLong").optional().or(z.literal("")),
  allocations: z.string().optional().or(z.literal("")),
});
