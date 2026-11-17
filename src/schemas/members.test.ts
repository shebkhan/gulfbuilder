import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { inviteSchema } from "./members";

const validInvite = { email: "staff@example.com", role: "manager", locale: "en" };

function messages(schema: z.ZodTypeAny, data: unknown): string[] {
  const result = schema.safeParse(data);
  if (result.success) return [];
  return result.error.issues.flatMap((issue) =>
    issue.code === "invalid_union"
      ? issue.unionErrors.flatMap((e) => e.issues.map((i) => String(i.message)))
      : [String(issue.message)],
  );
}

describe("inviteSchema", () => {
  it("accepts a valid invite", () => {
    expect(inviteSchema.safeParse(validInvite).success).toBe(true);
  });

  it("rejects a bad email with a translated key", () => {
    expect(messages(inviteSchema, { ...validInvite, email: "not-an-email" })).toContain(
      "validation.invalidEmail",
    );
  });
});
