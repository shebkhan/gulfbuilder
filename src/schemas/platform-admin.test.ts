import { describe, expect, it } from "vitest";
import { organizationSchema } from "./settings";
import { integrationSchema, lookupSchema } from "./platform-admin";
import { organizationUpdate } from "@/lib/org-settings";

const orgData = {
  name: "Demo Org",
  legalName: "",
  taxId: "",
  baseCurrency: "QAR",
  defaultLocale: "en",
  timezone: "Asia/Qatar",
  graceDays: 3,
  lateFee: "12.50",
  lateFeeType: "flat",
  lateFeePercent: 0,
  taxRate: 5,
  reminderDays: 7,
  revenueRecognition: "on_due",
};

const lookup = {
  orgId: "11111111-1111-1111-1111-111111111111",
  category: "unit_type",
  code: "studio",
  label: "Studio",
  sortOrder: 0,
  isActive: true,
};

describe("lookupSchema", () => {
  it("accepts a free-text lookup", () => {
    expect(lookupSchema.safeParse(lookup).success).toBe(true);
  });

  it("rejects an unknown code for a label category", () => {
    expect(
      lookupSchema.safeParse({ ...lookup, category: "payment_method_label", code: "bitcoin" })
        .success,
    ).toBe(false);
  });

  it("accepts a known enum code for a label category", () => {
    expect(
      lookupSchema.safeParse({ ...lookup, category: "payment_method_label", code: "cash" }).success,
    ).toBe(true);
  });
});

describe("integrationSchema", () => {
  it("allows an empty token so the stored token can be kept", () => {
    expect(
      integrationSchema.safeParse({
        provider: "telegram",
        botToken: "",
        botName: "Ops",
        chatId: "-1001",
        enabled: true,
      }).success,
    ).toBe(true);
  });

  it("accepts a WhatsApp phone for the public listing deep link", () => {
    expect(integrationSchema.safeParse({ provider: "whatsapp", phone: "+97455551234" }).success).toBe(
      true,
    );
  });
});

describe("organizationUpdate", () => {
  it("converts late fee to minor units and preserves unknown settings keys", () => {
    const data = organizationSchema.parse(orgData);
    const update = organizationUpdate(data, { custom_key: "keep" });
    expect(update.settings).toMatchObject({
      custom_key: "keep",
      late_fee_minor: 1250,
      grace_days: 3,
    });
    expect(update.name).toBe("Demo Org");
  });
});
