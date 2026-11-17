import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { registerChequeSchema, replaceChequeSchema } from "./cheques";

const UUID = "11111111-1111-4111-8111-111111111111";

const validRegister = {
  tenantId: UUID,
  leaseId: UUID,
  chequeNo: "000123",
  bankName: "QNB",
  amount: "150.00",
  chequeDate: "2026-11-17",
};

const validReplace = {
  oldChequeId: UUID,
  chequeNo: "000124",
  bankName: "QNB",
  amount: "150.00",
  chequeDate: "2026-11-17",
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

describe("registerChequeSchema", () => {
  it("accepts a valid cheque", () => {
    expect(registerChequeSchema.safeParse(validRegister).success).toBe(true);
  });

  it("requires an amount", () => {
    expect(messages(registerChequeSchema, { ...validRegister, amount: "" })).toContain(
      "validation.required",
    );
  });

  it("rejects a non-ISO cheque date", () => {
    expect(messages(registerChequeSchema, { ...validRegister, chequeDate: "17/11/2026" })).toContain(
      "validation.invalidDate",
    );
  });
});

describe("replaceChequeSchema", () => {
  it("accepts a valid replacement", () => {
    expect(replaceChequeSchema.safeParse(validReplace).success).toBe(true);
  });

  it("requires an amount", () => {
    expect(messages(replaceChequeSchema, { ...validReplace, amount: "" })).toContain(
      "validation.required",
    );
  });
});
