import { z } from "zod";

export const createExpenseSchema = z.object({
  category: z.string().trim().min(1, "validation.required").max(50, "validation.tooLong"),
  description: z.string().trim().min(1, "validation.required").max(300, "validation.tooLong"),
  amount: z.string().min(1, "validation.required"),
  currency: z.string().length(3, "validation.invalidInput").default("QAR"),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "validation.invalidDate"),
  vendorId: z.string().uuid("validation.invalidUuid").optional().or(z.literal("")),
  buildingId: z.string().uuid("validation.invalidUuid").optional().or(z.literal("")),
  unitId: z.string().uuid("validation.invalidUuid").optional().or(z.literal("")),
  notes: z.string().trim().max(500, "validation.tooLong").optional().or(z.literal("")),
});
