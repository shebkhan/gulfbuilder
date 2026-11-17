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

  it("renders payment and expense forms outside a dialog", () => {
    for (const name of ["payment-form.tsx", "expense-form.tsx"]) {
      const source = readFileSync(join(DOMAIN, name), "utf8");
      expect(source, name).not.toContain("@/components/ui/dialog");
      expect(source, name).not.toContain("fixed inset-0");
    }
  });

  it("renders maintenance and inspection forms outside a dialog", () => {
    for (const name of ["maintenance-form.tsx", "inspection-form.tsx"]) {
      const source = readFileSync(join(DOMAIN, name), "utf8");
      expect(source, name).not.toContain("@/components/ui/dialog");
      expect(source, name).not.toContain("fixed inset-0");
    }
  });

  it("renders cheque forms outside a dialog or overlay", () => {
    const source = readFileSync(join(DOMAIN, "cheque-table.tsx"), "utf8");
    expect(source).not.toContain("@/components/ui/dialog");
    expect(source).not.toContain("fixed inset-0");
  });

  it("renders deposit and statement forms outside an overlay", () => {
    for (const name of ["deposit-card.tsx", "statement-generator.tsx"]) {
      const source = readFileSync(join(DOMAIN, name), "utf8");
      expect(source, name).not.toContain("fixed inset-0");
    }
  });
});
