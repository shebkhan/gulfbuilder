import { z } from "zod";

export const createLeaseSchema = z.object({
  unitId: z.string().uuid().optional().or(z.literal("")),
  roomId: z.string().uuid().optional().or(z.literal("")),
  tenantId: z.string().uuid("validation.invalidUuid"),
  startDate: z
    .string()
    .min(1, "validation.required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "validation.invalidDate"),
  endDate: z
    .string()
    .min(1, "validation.required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "validation.invalidDate"),
  rent: z.string().min(1, "validation.required"),
  currency: z.string().length(3).default("QAR"),
  frequency: z.enum(["monthly", "quarterly", "semiannual", "annual"]),
  installments: z.coerce
    .number()
    .int("validation.invalidInput")
    .min(1, "validation.invalidRange")
    .default(1),
  dueDay: z.coerce
    .number()
    .int("validation.invalidInput")
    .min(1, "validation.invalidRange")
    .max(28, "validation.invalidRange")
    .default(1),
  deposit: z.string().optional().or(z.literal("")),
  noticeDays: z.coerce.number().int().min(0).default(60),
  isSublet: z.coerce.boolean().default(false),
  parentLeaseId: z.string().uuid().optional().or(z.literal("")),
  leaseNo: z.string().trim().max(50).optional().or(z.literal("")),
});
