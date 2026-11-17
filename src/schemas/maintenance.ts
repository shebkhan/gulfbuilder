import { z } from "zod";

export const createRequestSchema = z.object({
  buildingId: z.string().min(1, "validation.required").uuid("validation.invalidUuid"),
  unitId: z.string().uuid("validation.invalidUuid").optional().or(z.literal("")),
  roomId: z.string().uuid("validation.invalidUuid").optional().or(z.literal("")),
  tenantId: z.string().uuid("validation.invalidUuid").optional().or(z.literal("")),
  title: z.string().trim().min(3, "validation.required").max(150, "validation.tooLong"),
  description: z.string().trim().max(1000, "validation.tooLong").optional().or(z.literal("")),
  category: z.string().trim().min(1, "validation.required").default("general"),
  priority: z
    .enum(["low", "normal", "high", "urgent"], { message: "validation.required" })
    .default("normal"),
  vendorId: z.string().uuid("validation.invalidUuid").optional().or(z.literal("")),
});

export const updateStatusSchema = z.object({
  requestId: z.string().min(1, "validation.required").uuid("validation.invalidUuid"),
  status: z.enum(["open", "in_progress", "waiting_parts", "completed", "cancelled"], {
    message: "validation.required",
  }),
  note: z.string().trim().max(500, "validation.tooLong").optional().or(z.literal("")),
  cost: z.string().optional().or(z.literal("")),
});
