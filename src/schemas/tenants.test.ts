import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { tenantSchema } from "./tenants";

const validTenant = {
  fullName: "Jane Doe",
  kind: "person",
  language: "en",
  idNumber: "28863451234",
  phone: "+974 5555 1234",
  email: "jane@example.com",
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

describe("tenantSchema", () => {
  it("accepts a valid tenant", () => {
    expect(tenantSchema.safeParse(validTenant).success).toBe(true);
  });

  it("requires a full name", () => {
    expect(messages(tenantSchema, { ...validTenant, fullName: "" })).toContain(
      "validation.required",
    );
  });

  it("rejects a malformed email", () => {
    expect(messages(tenantSchema, { ...validTenant, email: "not-an-email" })).toContain(
      "validation.invalidEmail",
    );
  });

  it("rejects an id number longer than 30 characters", () => {
    expect(messages(tenantSchema, { ...validTenant, idNumber: "9".repeat(31) })).toContain(
      "validation.tooLong",
    );
  });
});
