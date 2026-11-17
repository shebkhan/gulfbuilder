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

test("related sections link buildings to tenants", async ({ page }) => {
  const locale = currentLocale();
  await signIn(page);
  await page.waitForURL(new RegExp(`/${locale}/(dashboard|mfa)`));
  await page.goto(`/${locale}/buildings`);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const subtitle =
    locale === "ar"
      ? "المباني والطوابق والوحدات في محفظتك."
      : "Buildings, floors and units across your portfolio.";
  await expect(page.getByText(subtitle)).toBeVisible();

  const stripLabel = locale === "ar" ? "أقسام ذات صلة" : "Related sections";
  const strip = page.getByText(stripLabel).locator("..");
  await expect(strip).toBeVisible();

  const tenants = locale === "ar" ? "المستأجرون" : "Tenants";
  await strip.getByRole("link", { name: tenants }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/tenants`));
});
