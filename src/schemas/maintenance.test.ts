import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { createRequestSchema, updateStatusSchema } from "./maintenance";

const UUID = "11111111-1111-4111-8111-111111111111";

const validRequest = { buildingId: UUID, title: "Leaking pipe" };
const validStatus = { requestId: UUID, status: "in_progress" };

function messages(schema: z.ZodTypeAny, data: unknown): string[] {
  const result = schema.safeParse(data);
  if (result.success) return [];
  return result.error.issues.flatMap((issue) =>
    issue.code === "invalid_union"
      ? issue.unionErrors.flatMap((e) => e.issues.map((i) => String(i.message)))
      : [String(issue.message)],
  );
}

describe("createRequestSchema", () => {
  it("accepts a valid request", () => {
    expect(createRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("requires a title", () => {
    expect(messages(createRequestSchema, { ...validRequest, title: "" })).toContain(
      "validation.required",
    );
  });
});

describe("updateStatusSchema", () => {
  it("accepts a valid status update", () => {
    expect(updateStatusSchema.safeParse(validStatus).success).toBe(true);
  });

  it("requires a status", () => {
    expect(messages(updateStatusSchema, { ...validStatus, status: "" })).toContain(
      "validation.required",
    );
  });
});
