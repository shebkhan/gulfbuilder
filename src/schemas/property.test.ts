import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { buildingSchema, floorsSchema, unitsSchema } from "./property";

const UUID = "11111111-1111-4111-8111-111111111111";

const validBuilding = { code: "TWR", name: "E2E Tower", ownerId: UUID, city: "Doha" };
const validUnit = {
  floorId: UUID,
  prefix: "A",
  start: 1,
  count: 4,
  pad: 2,
  unitType: "Office",
  areaSqm: 120,
  rent: "10000",
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

describe("property schemas", () => {
  it("accepts a valid building", () => {
    expect(buildingSchema.safeParse(validBuilding).success).toBe(true);
  });

  it("accepts a valid units array", () => {
    expect(unitsSchema.array().safeParse([validUnit, validUnit]).success).toBe(true);
  });

  it("requires a building code", () => {
    expect(messages(buildingSchema, { ...validBuilding, code: "" })).toContain(
      "validation.required",
    );
  });

  it("rejects a non-numeric floor count", () => {
    expect(floorsSchema.safeParse({ buildingId: UUID, from: "abc", to: 4 }).success).toBe(false);
    expect(unitsSchema.safeParse({ ...validUnit, count: "abc" }).success).toBe(false);
  });
});
