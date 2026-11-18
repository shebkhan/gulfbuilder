import { toMinor } from "@/lib/money";
import type { organizationSchema } from "@/schemas/settings";
import { z } from "zod";

type OrganizationData = z.infer<typeof organizationSchema>;

/** Shared by org-admin and platform-admin settings forms so both write the same settings JSON. */
export function organizationUpdate(data: OrganizationData, existingSettings: unknown) {
  return {
    name: data.name,
    legal_name: data.legalName || null,
    tax_id: data.taxId || null,
    base_currency: data.baseCurrency,
    default_locale: data.defaultLocale,
    timezone: data.timezone,
    settings: {
      ...((typeof existingSettings === "object" && existingSettings
        ? existingSettings
        : {}) as Record<string, unknown>),
      grace_days: data.graceDays,
      late_fee_minor: Number(toMinor(data.lateFee, data.baseCurrency)),
      late_fee_type: data.lateFeeType,
      late_fee_percent: data.lateFeePercent,
      tax_rate: data.taxRate,
      reminder_days: data.reminderDays,
      revenue_recognition: data.revenueRecognition,
    },
  };
}
