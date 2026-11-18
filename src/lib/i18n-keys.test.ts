import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

const sourceRoot = join(process.cwd(), "src");

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : [".ts", ".tsx"].includes(extname(path))
        ? [path]
        : [];
  });

const lookup = (messages: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>(
    (value, part) =>
      value && typeof value === "object"
        ? (value as Record<string, unknown>)[part]
        : undefined,
    messages,
  );

const usages = sourceFiles(sourceRoot).flatMap((file) => {
  const source = readFileSync(file, "utf8");
  const namespaces = [
    ...[...source.matchAll(/\buseTranslations\(\s*"([^"]+)"/g)].map((m) => m[1]),
    ...[...source.matchAll(/\bgetTranslations\(\s*"([^"]+)"/g)].map((m) => m[1]),
    ...[...source.matchAll(/namespace\s*:\s*"([^"]+)"/g)].map((m) => m[1]),
  ];
  if (/\b(?:useTranslations|getTranslations)\(\s*\)/.test(source)) {
    namespaces.push(""); // root namespace
  }
  if (!namespaces.length) return [];

  const keys = [...source.matchAll(/\bt(?:\.(?:rich|raw|has|markup))?\(\s*"([^"]+)"/g)].map(
    (m) => m[1]!,
  );
  return keys.map((key) => ({
    file: relative(process.cwd(), file),
    namespace: [...new Set(namespaces)].join("|"),
    key,
  }));
});

describe("translation keys", () => {
  it("resolves every literal translation key in en and ar", () => {
    expect(usages.length).toBeGreaterThan(0);
    const missing: string[] = [];
    for (const usage of usages) {
      for (const [locale, messages] of [
        ["en", en],
        ["ar", ar],
      ] as const) {
        const found = usage.namespace.split("|").some((namespace) => {
          const value = lookup(
            messages,
            namespace ? `${namespace}.${usage.key}` : usage.key,
          );
          return value !== undefined && value !== null && value !== "";
        });
        if (!found) missing.push(`${locale}: ${usage.file} [${usage.namespace}] ${usage.key}`);
      }
    }
    expect(missing, missing.join("\n")).toEqual([]);
  });
});
