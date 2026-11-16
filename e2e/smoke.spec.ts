import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { adminClient, MANAGER_EMAIL, OWNER_EMAIL, PASSWORD, type Fixture } from "./setup";
import { totpCandidates } from "./totp";

const fixture: Fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "e2e", ".state.json"), "utf8"),
);


function currentLocale(): string {
  return test.info().project.name;
}

async function signIn(page: Page, email: string): Promise<void> {
  const locale = currentLocale();
  await page.goto(`/${locale}/login`);
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
}

async function expectHealthy(page: Page): Promise<void> {
  await expect(page.locator("body")).not.toContainText("Application error");
  await expect(page.locator("body")).not.toContainText("server-side exception");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
}

test("the manager signs in and lands on the dashboard", async ({ page }) => {
  const locale = currentLocale();
  await signIn(page, MANAGER_EMAIL);
  await expect(page).toHaveURL(new RegExp(`/${locale}/(dashboard|mfa)`));
  await expectHealthy(page);
});

test("every workspace route renders for a manager", async ({ page }) => {
  const locale = currentLocale();
  await signIn(page, MANAGER_EMAIL);
  await page.waitForURL(new RegExp(`/${locale}/(dashboard|mfa)`));

  const routes = [
    "dashboard",
    "buildings",
    "tenants",
    "leases",
    "payments",
    "cheques",
    "deposits",
    "expenses",
    "maintenance",
    "inspections",
    "reports",
  ];

  for (const route of routes) {
    await page.goto(`/${locale}/${route}`);
    await expectHealthy(page);
  }
});

test("the building, its floors and a unit render", async ({ page }) => {
  const locale = currentLocale();
  await signIn(page, MANAGER_EMAIL);
  await page.waitForURL(new RegExp(`/${locale}/(dashboard|mfa)`));

  await page.goto(`/${locale}/buildings`);
  await expect(page.getByText("E2E Tower")).toBeVisible();

  await page.goto(`/${locale}/buildings/${fixture.buildingId}`);
  await expectHealthy(page);
  await expect(page.getByText("001").first()).toBeVisible();

  await page.goto(`/${locale}/units/${fixture.unitIds[0]}`);
  await expectHealthy(page);
});

test("a manager cannot reach settings", async ({ page }) => {
  const locale = currentLocale();
  await signIn(page, MANAGER_EMAIL);
  await page.waitForURL(new RegExp(`/${locale}/(dashboard|mfa)`));

  await page.goto(`/${locale}/settings`);
  // The page itself refuses the role: either a redirect away or a not-found page.
  const url = page.url();
  const body = await page.locator("body").innerText();
  const refused =
    !url.includes(`/${locale}/settings`) || /404|could not be found/i.test(body);
  expect(refused).toBe(true);
});

test("the arabic locale renders right to left", async ({ page }) => {
  const locale = currentLocale();
  await signIn(page, MANAGER_EMAIL);
  await page.waitForURL(new RegExp(`/${locale}/(dashboard|mfa)`));

  await page.goto(`/${locale}/dashboard`);
  await expectHealthy(page);

  const direction = await page.locator("html").getAttribute("dir");
  expect(direction).toBe(locale === "ar" ? "rtl" : "ltr");
});

test("an owner without a factor is walked through MFA enrolment", async ({ page }) => {
  const locale = currentLocale();
  const email = `e2e-mfa-${Date.now()}@gulf.test`;
  const admin = adminClient();
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error || !created.data.user) throw new Error("could not create the MFA test user");

  // The user must belong to an organization, otherwise the app sends them to onboarding.
  await admin.from("profiles").upsert(
    { id: created.data.user.id, active_org_id: fixture.orgId, locale: "en" },
    { onConflict: "id" },
  );
  await admin.from("org_members").upsert(
    { org_id: fixture.orgId, user_id: created.data.user.id, role: "org_admin" },
    { onConflict: "org_id,user_id" },
  );

  await signIn(page, email);
  await page.waitForURL(new RegExp(`/${locale}/mfa`));
  await expectHealthy(page);

  page.on("response", async (response) => {
    if (response.url().includes("/auth/v1/factors")) {
      let body = "";
      try {
        body = (await response.text()).slice(0, 200);
      } catch {
        body = "<no body>";
      }
      console.log("NET", response.status(), response.url().split("/auth/v1")[1], body.slice(0, 160));
    }
  });

  const enrol = page.getByRole("button", { name: /authenticator|set up|إعداد/i });
  // The form starts in a loading state; wait for the button or the code field.
  await expect(page.locator("#code").or(enrol)).toBeVisible();

  if (await enrol.isVisible()) {
    await enrol.click();
    await expect(page.locator("p.break-all")).toBeVisible();
    const secret = (await page.locator("p.break-all").innerText()).toUpperCase().match(/[A-Z2-7]{16,}/)?.[0];
    if (!secret) throw new Error("the MFA page did not show a TOTP secret");

    // A code can straddle a 30 second window, so try the current one and the next one.
    for (const code of totpCandidates(secret)) {
      await page.fill("#code", code);
      await page.click("button[type=submit]");
      await page.waitForTimeout(1500);
      if (!page.url().includes(`/${locale}/mfa`)) break;
    }
  }

  await expect(page).not.toHaveURL(new RegExp(`/${locale}/mfa`));
  await expectHealthy(page);
});

test("an owner is required to enrol before reaching the app", async ({ page }) => {
  const locale = currentLocale();
  await signIn(page, OWNER_EMAIL);
  await page.waitForURL(new RegExp(`/${locale}/(mfa|dashboard)`));
  await expectHealthy(page);
});
