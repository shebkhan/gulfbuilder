import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { brandingSchema, organizationSchema, templateSchema } from "./settings";

const validOrganization = {
  name: "Gulf Estates",
  legalName: "Gulf Estates WLL",
  taxId: "123456",
  baseCurrency: "QAR",
  defaultLocale: "en",
  timezone: "Asia/Qatar",
  graceDays: 5,
  lateFee: "50.00",
  lateFeeType: "flat",
  lateFeePercent: 0,
  taxRate: 0,
  reminderDays: 3,
  revenueRecognition: "on_due",
};

const validBranding = {
  appName: "Gulf Property",
  primaryColor: "#795919",
  secondaryColor: "#156c47",
  customDomain: "property.example.com",
};

const validTemplate = {
  event: "rent_due",
  channel: "email",
  locale: "en",
  subject: "Rent due",
  body: "Hello {{tenant}}, rent of {{amount}} is due on {{date}}.",
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

describe("organizationSchema", () => {
  it("accepts a valid organization", () => {
    expect(organizationSchema.safeParse(validOrganization).success).toBe(true);
  });

  it("rejects a name longer than 120 characters", () => {
    expect(messages(organizationSchema, { ...validOrganization, name: "x".repeat(121) })).toContain(
      "validation.tooLong",
    );
  });
});

describe("brandingSchema", () => {
  it("accepts valid branding", () => {
    expect(brandingSchema.safeParse(validBranding).success).toBe(true);
  });
});

describe("templateSchema", () => {
  it("accepts a valid template", () => {
    expect(templateSchema.safeParse(validTemplate).success).toBe(true);
  });

  it("requires a body", () => {
    expect(messages(templateSchema, { ...validTemplate, body: "" })).toContain(
      "validation.required",
    );
  });
});
