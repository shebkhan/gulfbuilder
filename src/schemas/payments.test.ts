import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { recordPaymentSchema } from "./payments";

const UUID = "11111111-1111-4111-8111-111111111111";

const valid = {
  tenantId: UUID,
  amount: "150.00",
  method: "cash",
  receivedAt: "2026-11-17",
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

describe("recordPaymentSchema", () => {
  it("accepts a valid payment", () => {
    expect(recordPaymentSchema.safeParse(valid).success).toBe(true);
  });

  it("requires an amount", () => {
    expect(messages(recordPaymentSchema, { ...valid, amount: "" })).toContain(
      "validation.required",
    );
  });
});
