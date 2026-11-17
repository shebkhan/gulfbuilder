import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

const KEYS = [
  "title",
  "description",
  "date",
  "allClear",
  "priorityItems",
  "repairs",
  "cheques",
  "confirmations",
  "leases",
  "viewAll",
  "urgent",
  "high",
  "normal",
  "low",
  "overdue",
  "dueToday",
  "awaiting",
  "daysLeft",
] as const;

type Messages = {
  nav: Record<string, string>;
  today?: Record<string, string>;
};

const assertLocale = (locale: string, messages: Messages) => {
  expect(messages.nav.today, `${locale} nav.today`).toBeTruthy();
  const today = messages.today ?? {};
  expect(Object.keys(today).sort(), `${locale} today keys`).toEqual([...KEYS].sort());
  for (const key of KEYS) {
    expect(today[key], `${locale} today.${key}`).toBeTruthy();
  }
};

describe("today translations", () => {
  it("defines the full today namespace in English", () =>
    assertLocale("en", en as unknown as Messages));

  it("defines the full today namespace in Arabic", () =>
    assertLocale("ar", ar as unknown as Messages));
});
