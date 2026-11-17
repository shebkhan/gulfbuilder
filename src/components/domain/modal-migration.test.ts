import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const DOMAIN = join(ROOT, "src/components/domain");

const tsxFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });

describe("form modal migration", () => {
  it("removes the shared FormDialog wrapper", () => {
    expect(existsSync(join(DOMAIN, "form-dialog.tsx"))).toBe(false);
    for (const file of tsxFiles(join(ROOT, "src"))) {
      expect(readFileSync(file, "utf8"), file).not.toContain("@/components/domain/form-dialog");
    }
  });
});
