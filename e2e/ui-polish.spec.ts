import { expect, test, type Page } from "@playwright/test";
import { MANAGER_EMAIL, PASSWORD } from "./setup";

function currentLocale(): string {
  return test.info().project.name;
}

async function signIn(page: Page): Promise<void> {
  const locale = currentLocale();
  await page.goto(`/${locale}/login`);
  await page.fill("#email", MANAGER_EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
}

test("sidebar collapses to an icon rail and remembers the choice", async ({ page }) => {
  const locale = currentLocale();
  await signIn(page);
  await page.waitForURL(new RegExp(`/${locale}/(dashboard|mfa)`));
  await page.goto(`/${locale}/dashboard`);

  const aside = page.locator("aside").first();
  await expect(aside).toBeVisible();
  expect((await aside.boundingBox())?.width ?? 0).toBeGreaterThan(150);

  const collapseLabel = locale === "ar" ? "طي القائمة الجانبية" : "Collapse sidebar";
  await page.getByRole("button", { name: collapseLabel }).click();
  await expect(aside).toHaveClass(/w-16/);
  await expect.poll(async () => (await aside.boundingBox())?.width ?? 0).toBeLessThan(100);

  await page.reload();
  const persisted = page.locator("aside").first();
  await expect(persisted).toHaveClass(/w-16/);
  await expect.poll(async () => (await persisted.boundingBox())?.width ?? 0).toBeLessThan(100);
});

test("lease form shows an inline error for empty rent", async ({ page }) => {
  const locale = currentLocale();
  await signIn(page);
  await page.waitForURL(new RegExp(`/${locale}/(dashboard|mfa)`));
  await page.goto(`/${locale}/leases/new`);

  const rent = locale === "ar" ? "قيمة الإيجار" : "Rent";
  const create = locale === "ar" ? "إنشاء العقد" : "Create lease";
  const required = locale === "ar" ? "هذا الحقل مطلوب" : "This field is required";

  await page.getByLabel(rent).fill("");
  await page.getByRole("button", { name: create }).click();

  await expect(page.getByText(required).first()).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/${locale}/leases/new`));
});
