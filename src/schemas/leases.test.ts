import { describe, expect, it } from "vitest";
import { createLeaseSchema } from "./leases";

const UUID = "11111111-1111-4111-8111-111111111111";

const valid = {
  unitId: UUID,
  tenantId: UUID,
  startDate: "2026-11-17",
  endDate: "2027-11-17",
  rent: "10000",
  currency: "QAR",
  frequency: "annual",
  installments: 4,
  dueDay: 1,
  deposit: "0",
  noticeDays: 60,
  isSublet: false,
  leaseNo: "LSE-2026-1",
};

function messagesFor(data: Record<string, unknown>): string[] {
  const result = createLeaseSchema.safeParse(data);
  return result.success
    ? []
    : result.error.issues.map((issue) => String(issue.message));
}

describe("createLeaseSchema", () => {
  it("accepts a valid lease", () => {
    expect(createLeaseSchema.safeParse(valid).success).toBe(true);
  });

  it("requires rent", () => {
    expect(messagesFor({ ...valid, rent: "" })).toContain("validation.required");
  });

  it("rejects a non-ISO start date", () => {
    expect(messagesFor({ ...valid, startDate: "17/11/2026" })).toContain(
      "validation.invalidDate",
    );
  });

  it("requires an end date", () => {
    expect(messagesFor({ ...valid, endDate: "" })).toContain("validation.required");
  });

  it("accepts a sublet with a parent lease", () => {
    expect(
      createLeaseSchema.safeParse({ ...valid, isSublet: true, parentLeaseId: UUID }).success,
    ).toBe(true);
  });
});
