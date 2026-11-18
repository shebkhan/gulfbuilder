import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

const source = readFileSync(
  join(
    process.cwd(),
    "src/app/[locale]/(app)/reports/cash-flow-forecast/page.tsx",
  ),
  "utf8",
);
const namespace = source.match(/useTranslations\("([^"]+)"\)/)?.[1] ?? "";
const keys = [...source.matchAll(/\bt\("([^"]+)"/g)].map((match) => match[1]);

const lookup = (messages: Record<string, unknown>, path: string): unknown =>
  path.split(".").reduce<unknown>(
    (value, part) =>
      value && typeof value === "object"
        ? (value as Record<string, unknown>)[part]
        : undefined,
    messages,
  );

describe("cash flow forecast translations", () => {
  it("uses every translation key the page renders", () => {
    expect(keys.length).toBeGreaterThan(0);
    for (const [locale, messages] of [
      ["en", en],
      ["ar", ar],
    ] as const) {
      expect(lookup(messages, namespace), `${locale} namespace ${namespace}`).toBeTruthy();
      for (const key of keys) {
        const value = lookup(messages, `${namespace}.${key}`);
        expect(typeof value, `${locale}: ${key}`).toBe("string");
        expect(value, `${locale}: ${key}`).toBeTruthy();
      }
    }
  });
});
