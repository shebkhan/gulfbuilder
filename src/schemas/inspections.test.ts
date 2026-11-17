import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { completeInspectionSchema, createInspectionSchema } from "./inspections";

const UUID = "11111111-1111-4111-8111-111111111111";

const validCreate = { leaseId: UUID, kind: "move_in" };
const validComplete = { inspectionId: UUID };

function messages(schema: z.ZodTypeAny, data: unknown): string[] {
  const result = schema.safeParse(data);
  if (result.success) return [];
  return result.error.issues.flatMap((issue) =>
    issue.code === "invalid_union"
      ? issue.unionErrors.flatMap((e) => e.issues.map((i) => String(i.message)))
      : [String(issue.message)],
  );
}

describe("createInspectionSchema", () => {
  it("accepts a valid inspection", () => {
    expect(createInspectionSchema.safeParse(validCreate).success).toBe(true);
  });

  it("requires a lease", () => {
    expect(messages(createInspectionSchema, { ...validCreate, leaseId: "" })).toContain(
      "validation.required",
    );
  });
});

describe("completeInspectionSchema", () => {
  it("accepts a valid completion", () => {
    expect(completeInspectionSchema.safeParse(validComplete).success).toBe(true);
  });

  it("requires an inspection id", () => {
    expect(messages(completeInspectionSchema, { ...validComplete, inspectionId: "" })).toContain(
      "validation.required",
    );
  });

  it("requires a reason when a deduction amount is positive", () => {
    expect(
      messages(completeInspectionSchema, {
        ...validComplete,
        deductAmount: "150.00",
        deductReason: "",
      }),
    ).toContain("validation.required");
  });

  it("allows an empty reason when there is no deduction", () => {
    expect(
      completeInspectionSchema.safeParse({ ...validComplete, deductAmount: "", deductReason: "" })
        .success,
    ).toBe(true);
  });
});
