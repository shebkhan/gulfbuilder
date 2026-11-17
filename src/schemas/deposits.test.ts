import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { deductionSchema, refundSchema } from "./deposits";

const UUID = "11111111-1111-4111-8111-111111111111";

const validDeduction = { depositId: UUID, amount: "50.00", reason: "Damage repairs" };
const validRefund = { depositId: UUID, amount: "50.00" };

function messages(schema: z.ZodTypeAny, data: unknown): string[] {
  const result = schema.safeParse(data);
  if (result.success) return [];
  return result.error.issues.flatMap((issue) =>
    issue.code === "invalid_union"
      ? issue.unionErrors.flatMap((e) => e.issues.map((i) => String(i.message)))
      : [String(issue.message)],
  );
}

describe("deductionSchema", () => {
  it("accepts a valid deduction", () => {
    expect(deductionSchema.safeParse(validDeduction).success).toBe(true);
  });

  it("requires an amount", () => {
    expect(messages(deductionSchema, { ...validDeduction, amount: "" })).toContain(
      "validation.required",
    );
  });
});

describe("refundSchema", () => {
  it("accepts a valid refund", () => {
    expect(refundSchema.safeParse(validRefund).success).toBe(true);
  });

  it("requires an amount", () => {
    expect(messages(refundSchema, { ...validRefund, amount: "" })).toContain(
      "validation.required",
    );
  });
});
