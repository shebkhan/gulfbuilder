import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { adminClient, type Fixture } from "./setup";

const fixture: Fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "e2e", ".state.json"), "utf8"),
);

const locale = () => test.info().project.name;
const listingTitle = "E2E Tower 001";

async function healthy(page: Page): Promise<void> {
  await expect(page.locator("body")).not.toContainText("Application error");
  await expect(page.locator("body")).not.toContainText("server-side exception");
}

test("a visitor browses the public landing page", async ({ page }) => {
  const l = locale();
  await page.goto(`/${l}`);
  await healthy(page);
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator(`a[href*="${fixture.listingSlug}"]`).first()).toBeVisible();
  // The public marketplace must never require a session.
  expect(page.url()).not.toContain("/login");
});

test("a visitor filters listings by keyword and city", async ({ page }) => {
  const l = locale();
  await page.goto(`/${l}/properties?city=Doha`);
  await healthy(page);
  await expect(page.locator(`a[href*="${fixture.listingSlug}"]`).first()).toBeVisible();

  await page.goto(`/${l}/properties?q=zzzz-no-such-listing`);
  await healthy(page);
  await expect(page.locator(`a[href*="${fixture.listingSlug}"]`)).toHaveCount(0);

  await page.goto(`/${l}`);
  const form = page.locator("form").first();
  await form.locator("#q").fill("E2E Tower");
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`/${l}/properties`));
  await expect(page.locator(`a[href*="${fixture.listingSlug}"]`).first()).toBeVisible();
});

test("a listing detail renders specs, JSON-LD and share links", async ({ page }) => {
  const l = locale();
  await page.goto(`/${l}/properties/${fixture.listingSlug}`);
  await healthy(page);
  await expect(page.locator("h1")).toContainText(listingTitle);
  await expect(page.locator('script[type="application/ld+json"]')).toContainText("Residence");
  await expect(page.locator('a[href^="https://wa.me/"]').first()).toBeVisible();
  await expect(page.locator('a[href*="facebook.com/"]').first()).toBeVisible();
  await expect(page.locator("#enquiry-name")).toBeVisible();
});

test("an anonymous visitor can send an enquiry that reaches the org inbox", async ({ page }) => {
  const l = locale();
  const admin = adminClient();
  const before = await admin
    .from("listing_enquiries")
    .select("id", { count: "exact", head: true })
    .eq("unit_id", fixture.unitIds[0]);

  await page.goto(`/${l}/properties/${fixture.listingSlug}`);
  await page.fill("#enquiry-name", "E2E Visitor");
  await page.fill("#enquiry-email", "e2e-visitor@gulf.test");
  await page.fill("#enquiry-message", "Is this flat still available next month?");
  await page.locator('form button[type="submit"]').click();

  await expect(page.getByRole("status")).toBeVisible();
  await expect
    .poll(async () => {
      const after = await admin
        .from("listing_enquiries")
        .select("id", { count: "exact", head: true })
        .eq("unit_id", fixture.unitIds[0]);
      return after.count ?? 0;
    })
    .toBe((before.count ?? 0) + 1);
});
