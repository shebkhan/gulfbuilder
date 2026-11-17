import { z } from "zod";

export const createInspectionSchema = z.object({
  leaseId: z.string().min(1, "validation.required").uuid("validation.invalidUuid"),
  kind: z.enum(["move_in", "move_out"], { message: "validation.required" }),
  notes: z.string().trim().max(500, "validation.tooLong").optional().or(z.literal("")),
});

export const completeInspectionSchema = z
  .object({
    inspectionId: z.string().min(1, "validation.required").uuid("validation.invalidUuid"),
    checklistData: z.string().default("{}"),
    deductAmount: z.string().optional().or(z.literal("")),
    deductReason: z.string().trim().max(300, "validation.tooLong").optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (Number(data.deductAmount) > 0 && !data.deductReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deductReason"],
        message: "validation.required",
      });
    }
  });
