import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { uploadSchema } from "./documents";

const UUID = "11111111-1111-4111-8111-111111111111";

const valid = { entityType: "lease", entityId: UUID, kind: "contract" };

function messages(schema: z.ZodTypeAny, data: unknown): string[] {
  const result = schema.safeParse(data);
  if (result.success) return [];
  return result.error.issues.flatMap((issue) =>
    issue.code === "invalid_union"
      ? issue.unionErrors.flatMap((e) => e.issues.map((i) => String(i.message)))
      : [String(issue.message)],
  );
}

describe("uploadSchema", () => {
  it("accepts a valid upload", () => {
    expect(uploadSchema.safeParse(valid).success).toBe(true);
  });

  it("requires an entity", () => {
    expect(messages(uploadSchema, { ...valid, entityId: "" })).toContain("validation.required");
  });

  it("rejects a non-ISO expiry date", () => {
    expect(messages(uploadSchema, { ...valid, expiresOn: "17/11/2026" })).toContain(
      "validation.invalidDate",
    );
  });
});
