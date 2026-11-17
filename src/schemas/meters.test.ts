import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { meterSchema, readingSchema } from "./meters";

const UUID = "11111111-1111-4111-8111-111111111111";

const validMeter = { kind: "electricity", buildingId: UUID };
const validReading = { meterId: UUID, readOn: "2026-11-17", value: "123.5" };

function messages(schema: z.ZodTypeAny, data: unknown): string[] {
  const result = schema.safeParse(data);
  if (result.success) return [];
  return result.error.issues.flatMap((issue) =>
    issue.code === "invalid_union"
      ? issue.unionErrors.flatMap((e) => e.issues.map((i) => String(i.message)))
      : [String(issue.message)],
  );
}

describe("meterSchema", () => {
  it("accepts a valid meter", () => {
    expect(meterSchema.safeParse(validMeter).success).toBe(true);
  });

  it("requires a building", () => {
    expect(messages(meterSchema, { ...validMeter, buildingId: "" })).toContain(
      "validation.required",
    );
  });
});

describe("readingSchema", () => {
  it("accepts a valid reading", () => {
    expect(readingSchema.safeParse(validReading).success).toBe(true);
  });

  it("requires a value", () => {
    expect(messages(readingSchema, { ...validReading, value: "" })).toContain(
      "validation.required",
    );
  });

  it("rejects a non-ISO reading date", () => {
    expect(messages(readingSchema, { ...validReading, readOn: "17/11/2026" })).toContain(
      "validation.invalidDate",
    );
  });
});
