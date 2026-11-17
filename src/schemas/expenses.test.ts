import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { createExpenseSchema } from "./expenses";

const valid = {
  category: "maintenance",
  description: "AC repair",
  amount: "250.00",
  expenseDate: "2026-11-17",
};

function messages(schema: z.ZodTypeAny, data: unknown): string[] {
  const result = schema.safeParse(data);
  if (result.success) return [];
  return result.error.issues.flatMap((issue) =>
    issue.code === "invalid_union"
      ? issue.unionErrors.flatMap((e) => e.issues.map((i) => String(i.message)))
      : [String(issue.message)],
  );
}

describe("createExpenseSchema", () => {
  it("accepts a valid expense", () => {
    expect(createExpenseSchema.safeParse(valid).success).toBe(true);
  });

  it("requires an amount", () => {
    expect(messages(createExpenseSchema, { ...valid, amount: "" })).toContain(
      "validation.required",
    );
  });
});
