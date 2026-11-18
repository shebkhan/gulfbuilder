# Theme presets and organization branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give super-admins a theme preset catalog and org admins logo upload, then render the org logo on every v1 surface.

**Architecture:** Global `theme_presets` table and a public `branding` Storage bucket; preset selection copies colors/font into the existing `org_branding` row (snapshot, no live link). A shared `getBrand()` helper feeds the root layout, login, PWA manifest and app shell; print pages pass `logo_url` explicitly; the email notifier gains an HTML body with an escaped logo header.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Supabase Postgres/Storage/Auth, Zod, react-hook-form, next-intl, Vitest, pgTAP, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-theme-presets-and-branding-design.md`

## Global Constraints

- TypeScript strict, no `any`; Zod schemas live in `src/schemas/`; files kebab-case, React components PascalCase, DB snake_case.
- All user-visible strings via next-intl in `messages/en.json` and `messages/ar.json`; Arabic RTL uses logical Tailwind utilities only.
- RLS on every table; write policies check `org_id = auth_org()`. `theme_presets` is the documented global exception (like `market_packs`): select to `authenticated`, writes via service-role client from `(platform)` only.
- Storage paths start with `{org_id}/`; `branding` bucket policy checks the first path segment against `auth_org()` and requires `auth_role() = 'org_admin'` for writes.
- Preset colors match `^#[0-9a-fA-F]{6}$`; font family is at most 80 characters and restricted to letters, digits, spaces, commas, hyphens and single quotes.
- Uploads accept PNG/JPEG/WebP only, 2 MB maximum; filenames sanitized and UUID-prefixed.
- Service-role client only in `src/lib/supabase/admin.ts`, imported by `(platform)` and the existing notification/dispatch modules; never log secrets or IDs.
- Schema changes only in new files under `supabase/migrations/`; regenerate `src/types/database.ts` after the migration.
- `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` live in `.env.local` (gitignored). The key previously pasted in chat must be rotated.

## Review Focus

1. **Cross-tenant logo write** — an `org_admin` must not upload into another org's path. Tested by Task 1 pgTAP write-policy assertion.
2. **Anonymous write to public bucket** — public read must not imply public write. Tested by Task 1 pgTAP `anon` insert denial.
3. **CSS injection through font family** — a preset font containing `;` or `}` must be rejected. Tested by Task 2 Vitest schema test.
4. **Unescaped email body** — text containing `<script>` and `&` must render as literal text in HTML email. Tested by Task 6 Vitest escaping test.
5. **No branding row / no logo** — every surface must render its default mark without throwing. Tested by Task 4 Playwright assertions on the unbranded demo state and Task 5 print smoke.

---

## File structure

**Create**
- `supabase/migrations/20261118000048_theme_presets.sql` — table, constraints, RLS, bucket, policies.
- `supabase/tests/0002_theme_presets_test.sql` — pgTAP coverage.
- `src/schemas/theme.ts` + `src/schemas/theme.test.ts` — shared preset validation.
- `src/components/domain/theme-preset-form.tsx` — super-admin preset editor.
- `src/app/[locale]/(platform)/platform/themes/page.tsx` — super-admin preset list.
- `src/lib/html.ts` + `src/lib/html.test.ts` — email escaping helper.
- `e2e/branding.spec.ts` — Playwright flow in `en` and `ar`.

**Modify**
- `src/types/database.ts` (generated), `src/server/actions/platform.ts`, `src/components/domain/nav-items.ts`, `messages/en.json`, `messages/ar.json`.
- `src/server/actions/settings.ts`, `src/schemas/settings.ts`, `src/schemas/settings.test.ts`, `src/components/domain/branding-form.tsx`, `src/app/[locale]/(app)/settings/branding/page.tsx`.
- `src/lib/white-label.ts`, `src/app/[locale]/layout.tsx`, `src/components/domain/app-shell.tsx`, `src/components/domain/collapsible-sidebar.tsx`, `src/app/[locale]/(app)/layout.tsx`, `src/app/[locale]/owner/layout.tsx`, `src/app/[locale]/portal/layout.tsx`, `src/app/[locale]/(auth)/login/page.tsx`, `src/app/manifest.ts`.
- `src/components/domain/print-document.tsx` and the four print pages under `src/app/[locale]/print/`.
- `src/server/notifications/notifier.ts`, `src/server/notifications/recipient.ts`, `src/server/notifications/notifiers/resend.ts`, `src/server/notifications/notifier.test.ts`, `src/server/notifications/recipient.test.ts`.
- `docs/DECISIONS.md`.

---

### Task 1: Schema, storage bucket and database tests

**Files:**
- Create: `supabase/migrations/20261118000048_theme_presets.sql`, `supabase/tests/0002_theme_presets_test.sql`
- Modify: `src/types/database.ts` (generated)

**Interfaces:**
- Consumes: existing `auth_org()`, `auth_role()`, `set_updated_at()` helpers and `market_packs` policies as the precedent.
- Produces: `public.theme_presets(code text pk, name text, primary_color text, secondary_color text, font_family text, is_default bool, created_at, updated_at, created_by)`; `branding` storage bucket; policies named `theme_presets_read`, `branding_read`, `branding_write`.

- [ ] **Step 1: Write the failing pgTAP test**

In `supabase/tests/0002_theme_presets_test.sql`, assert: table exists; `theme_presets` has RLS enabled; `authenticated` can select; `anon` and direct `authenticated` insert/update/delete fail; at most one `is_default` row is allowed; the `branding` bucket exists; `anon` insert into `storage.objects` fails; `authenticated` with matching `auth_org()` prefix and role `org_admin` can insert; a different org prefix fails.

- [ ] **Step 2: Run the test to verify it fails**

Run: `supabase db reset && supabase test db`
Expected: FAIL on `has_table('public','theme_presets', ...)`.

- [ ] **Step 3: Write the migration**

Create the table with the exact columns in Interfaces, check constraints from Global Constraints, `set_updated_at` trigger, partial unique index `one_default_theme_preset on theme_presets((is_default)) where is_default`, RLS select policy `theme_presets_read to authenticated using (true)`, no write policies. Insert bucket `('branding','branding',true)` and the three storage policies described above using `(storage.foldername(name))[1]`.

- [ ] **Step 4: Regenerate types**

Run: `supabase gen types typescript --local > src/types/database.ts`
Expected: `theme_presets` appears in the generated `Database` type.

- [ ] **Step 5: Run the test to verify it passes**

Run: `supabase test db`
Expected: all assertions in `0002_theme_presets_test.sql` pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261118000048_theme_presets.sql supabase/tests/0002_theme_presets_test.sql src/types/database.ts
git commit -m "feat(db): add theme presets and branding storage bucket"
```

---

### Task 2: Preset validation and super-admin console

**Files:**
- Create: `src/schemas/theme.ts`, `src/schemas/theme.test.ts`, `src/components/domain/theme-preset-form.tsx`, `src/app/[locale]/(platform)/platform/themes/page.tsx`
- Modify: `src/server/actions/platform.ts`, `src/components/domain/nav-items.ts`, `messages/en.json`, `messages/ar.json`

**Interfaces:**
- Consumes: `PlatformState`, `platformAdmin()`, `audit()` and `createSupabaseAdminClient()` from `src/server/actions/platform.ts`; `PLATFORM_NAV` from `nav-items.ts`.
- Produces: `themePresetSchema` and `type ThemePresetInput`; actions `upsertThemePresetAction(_prev: PlatformState, formData: FormData): Promise<PlatformState>` and `setDefaultThemePresetAction(_prev: PlatformState, formData: FormData): Promise<PlatformState>`, both keyed by form field `code`.

- [ ] **Step 1: Write the failing schema tests**

In `src/schemas/theme.test.ts` add tests named `accepts a valid preset`, `rejects a colour that is not 6-digit hex`, `rejects a font containing a CSS delimiter`, and `rejects a code with uppercase or spaces`. Assert `safeParse(...).success` and that the invalid cases return `false`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/schemas/theme.test.ts`
Expected: FAIL with "Cannot find module './theme'".

- [ ] **Step 3: Implement `themePresetSchema`**

In `src/schemas/theme.ts` export a Zod object with `code` (`/^[a-z0-9-]+$/`), `name` (2–80), `primaryColor`/`secondaryColor` (hex regex), `fontFamily` (1–80, `/^[A-Za-z0-9 ,'\-]+$/`), and `isDefault: z.coerce.boolean()`. Export `type ThemePresetInput = z.infer<typeof themePresetSchema>`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/schemas/theme.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add the platform actions**

In `src/server/actions/platform.ts`, implement both actions using `platformAdmin()` and `audit()`: `upsertThemePresetAction` validates with `themePresetSchema` then service-role upserts on `code`; `setDefaultThemePresetAction` clears `is_default` on all rows and sets it for the submitted `code` in one transaction-equivalent sequence. Also extend `createOrganizationAction`: after inserting the org, read the default preset with the admin client and include its `primary_color`, `secondary_color` and `font_family` in the `org_branding` insert; leave them null when there is no default.

- [ ] **Step 6: Build the super-admin preset page**

Add `ThemePresetForm` (fields from `ThemePresetInput`, `useActionState`, a set-default button bound to `setDefaultThemePresetAction`) and `platform/themes/page.tsx` listing presets plus a blank form.

- [ ] **Step 7: Add navigation and translations**

Add `{ href: "/platform/themes", labelKey: "themes", capability: "platform.admin" }` to `PLATFORM_NAV`. Add `platform.themes.*` and matching Arabic strings for title, subtitle, fields, saved, and the four error keys used by the actions.

- [ ] **Step 8: Verify and commit**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: no lint/type errors; all Vitest tests pass.

```bash
git add src/schemas/theme.ts src/schemas/theme.test.ts src/components/domain/theme-preset-form.tsx "src/app/[locale]/(platform)/platform/themes/page.tsx" src/server/actions/platform.ts src/components/domain/nav-items.ts messages/en.json messages/ar.json
git commit -m "feat(platform): theme preset catalog and default seeding"
```

---

### Task 3: Org preset picker and logo upload

**Files:**
- Modify: `src/server/actions/settings.ts`, `src/schemas/settings.ts`, `src/schemas/settings.test.ts`, `src/components/domain/branding-form.tsx`, `src/app/[locale]/(app)/settings/branding/page.tsx`, `messages/en.json`, `messages/ar.json`

**Interfaces:**
- Consumes: `getOrgContext()` returning `OrgContext` (`orgId`, `role`, `supabase`), `can(role, "settings.write")`, `brandingSchema`, `org_branding` row shape.
- Produces: `export type UploadBrandAssetState = { error?: string; ok?: string; url?: string }`; `export async function uploadBrandAssetAction(_prev: UploadBrandAssetState, formData: FormData): Promise<UploadBrandAssetState>` accepting `kind` = `logo` | `favicon` and `file` = `File`; `BrandingForm` gains `presets: { code: string; name: string; primaryColor: string; secondaryColor: string; fontFamily: string }[]`.

- [ ] **Step 1: Write a failing URL validation test**

In `src/schemas/settings.test.ts` add `it("rejects a non-http logo URL")`, asserting `messages(brandingSchema, { ...validBranding, logoUrl: "javascript:alert(1)" })` contains `"invalid_url"`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/schemas/settings.test.ts`
Expected: FAIL — the message is not present.

- [ ] **Step 3: Tighten `brandingSchema`**

In `src/schemas/settings.ts`, replace the `logoUrl` and `faviconUrl` string rules with a refinement that accepts only `""` or `http(s)://` URLs (use `new URL(value)` and check `protocol`) and emits `"invalid_url"`. Keep the 300-character limit.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/schemas/settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the upload action**

In `src/server/actions/settings.ts`, implement `uploadBrandAssetAction`: require `getOrgContext()` and `can(ctx.role, "settings.write")`; validate `kind` against a two-value enum; require a non-empty `File` of type `image/png`, `image/jpeg` or `image/webp` and at most 2 MB; build path `${ctx.orgId}/${kind}/${crypto.randomUUID()}-${safeName}` with `safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")`; upload to `ctx.supabase.storage.from("branding")`; on failure return `{ error: "upload_failed" }`; update `org_branding.logo_url` or `favicon_url` with `getPublicUrl(...).publicUrl`; on database error remove the uploaded object and return `{ error: "failed" }`; return `{ ok: "uploaded", url }`. Add the matching error strings to both locale files under `settings.branding.errors`.

- [ ] **Step 6: Add the preset picker to the form**

Extend `BrandingForm` with a preset `<Select>` that calls `setValue("primaryColor"/"secondaryColor"/"fontFamily")` for the chosen preset. Keep the existing custom color/font inputs editable.

- [ ] **Step 7: Add upload controls and load presets**

Add two small upload forms to `BrandingForm` using `useActionState(uploadBrandAssetAction)` with hidden `kind` fields and a preview `<img>` of the current URL. Update the branding page to select presets ordered by `name` and pass them as `presets`.

- [ ] **Step 8: Verify and commit**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: clean.

```bash
git add src/server/actions/settings.ts src/schemas/settings.ts src/schemas/settings.test.ts src/components/domain/branding-form.tsx "src/app/[locale]/(app)/settings/branding/page.tsx" messages/en.json messages/ar.json
git commit -m "feat(settings): theme preset picker and logo upload"
```

---

### Task 4: Shared brand lookup, app shell, login and PWA

**Files:**
- Modify: `src/lib/white-label.ts`, `src/app/[locale]/layout.tsx`, `src/components/domain/app-shell.tsx`, `src/components/domain/collapsible-sidebar.tsx`, `src/app/[locale]/(app)/layout.tsx`, `src/app/[locale]/owner/layout.tsx`, `src/app/[locale]/portal/layout.tsx`, `src/app/[locale]/(auth)/login/page.tsx`, `src/app/manifest.ts`, `e2e/branding.spec.ts` (create)

**Interfaces:**
- Consumes: `Brand` and `decodeBrand()` from `src/lib/white-label.ts`; `x-brand` request header set by middleware.
- Produces: `export async function getBrand(): Promise<Brand | null>` in `src/lib/white-label.ts`; `logoUrl?: string | null` added to `AppShellProps` and `CollapsibleSidebar` props.

- [ ] **Step 1: Write the failing Playwright check**

In `e2e/branding.spec.ts`, add a test for each locale in `["en", "ar"]` that visits `/${locale}/login` and asserts the default brand mark is present (no logo configured), and a test that signs in as the demo org admin and asserts an `img` with the org logo URL appears in the app shell. Use the existing `e2e/setup.ts` fixtures.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:e2e e2e/branding.spec.ts`
Expected: FAIL — no logo element exists.

- [ ] **Step 3: Add `getBrand()` and refactor the root layout**

In `src/lib/white-label.ts`, export `getBrand()` that reads `headers().get("x-brand")` inside a `try/catch` (static prerendering may have no headers) and returns `decodeBrand(value)`. In `src/app/[locale]/layout.tsx`, replace the inline header decode with `getBrand()`; keep terminology and CSS variables unchanged.

- [ ] **Step 4: Render the logo in the shell components**

Add `logoUrl?: string | null` to `AppShellProps` and `CollapsibleSidebar` props; render an `<img src={logoUrl ?? "/icons/icon.svg"} alt="" />` beside `orgName`.

- [ ] **Step 5: Pass the brand logo from the layouts**

Pass `logoUrl={(await getBrand())?.logoUrl}` from the `(app)`, `owner` and `portal` layouts. The `(platform)` layout passes nothing.

- [ ] **Step 6: Render the logo on login and in the PWA**

In the login page, call `getBrand()` and render `<img src={brand?.logoUrl ?? "/icons/icon.svg"} alt="" />` above the heading. In `src/app/manifest.ts`, call `getBrand()` and set `name`, `short_name`, `theme_color`, `background_color` from the brand with the current static values as fallbacks; append a logo icon entry using the existing `sizes: "any"` shape.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test:e2e e2e/branding.spec.ts && pnpm typecheck`
Expected: all four Playwright assertions pass; no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/white-label.ts "src/app/[locale]/layout.tsx" src/components/domain/app-shell.tsx src/components/domain/collapsible-sidebar.tsx "src/app/[locale]/(app)/layout.tsx" "src/app/[locale]/owner/layout.tsx" "src/app/[locale]/portal/layout.tsx" "src/app/[locale]/(auth)/login/page.tsx" src/app/manifest.ts e2e/branding.spec.ts
git commit -m "feat(branding): render org logo in shell, login and PWA"
```

---

### Task 5: Print documents

**Files:**
- Modify: `src/components/domain/print-document.tsx`, `src/app/[locale]/print/contract/[id]/page.tsx`, `src/app/[locale]/print/receipt/[id]/page.tsx`, `src/app/[locale]/print/statement/[id]/page.tsx`, `src/app/[locale]/print/owner-statement/[id]/page.tsx`, `e2e/branding.spec.ts`

**Interfaces:**
- Consumes: `logo_url` from `org_branding`; `PrintDocument` props `title`, `orgName`, `lines`, `totals`, `footer`.
- Produces: `PrintDocument` gains `logoUrl?: string | null`; each print page passes `logoUrl={branding?.logo_url ?? null}`.

- [ ] **Step 1: Write the failing Playwright check**

In `e2e/branding.spec.ts`, add a test that visits the seeded receipt print route for the branded demo org and asserts the logo `img` is inside the printed `<article>` header, plus a test that the same route still renders when `logo_url` is null.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:e2e e2e/branding.spec.ts`
Expected: FAIL on the logo assertion.

- [ ] **Step 3: Add the prop and render**

Add `logoUrl?: string | null` to `PrintDocument` props and render it in the existing `<header>` next to `orgName` only when present. Use a print-safe `<img>` with a fixed small height and `alt=""`.

- [ ] **Step 4: Pass the URL from all four print pages**

In each of the four page files, add `logo_url` to the existing `org_branding` select and pass `logoUrl={branding?.logo_url ?? null}` into `<PrintDocument>`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:e2e e2e/branding.spec.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/print-document.tsx "src/app/[locale]/print" e2e/branding.spec.ts
git commit -m "feat(branding): show org logo on printed documents"
```

---

### Task 6: Branded HTML email

**Files:**
- Create: `src/lib/html.ts`, `src/lib/html.test.ts`
- Modify: `src/server/notifications/notifier.ts`, `src/server/notifications/recipient.ts`, `src/server/notifications/notifiers/resend.ts`, `src/server/notifications/notifier.test.ts`, `src/server/notifications/recipient.test.ts`, `messages/en.json`, `messages/ar.json`

**Interfaces:**
- Consumes: `Outbound`, `resolveOutbound(row, admin)` and `resendNotifier`.
- Produces: `escapeHtml(value: string): string` and `renderBrandedEmail(input: { body: string; appName?: string | null; logoUrl?: string | null }): string`; `Outbound` gains `logoUrl?: string | null` and `appName?: string | null`.

- [ ] **Step 1: Write the failing escaping tests**

In `src/lib/html.test.ts`, add `it("escapes script tags and ampersands")` asserting `escapeHtml('<script>alert("x")</script> &') === "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp;"`, and `it("omits a missing logo")` asserting `renderBrandedEmail({ body: "Hello" })` contains no `<img`.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test src/lib/html.test.ts`
Expected: FAIL with "Cannot find module './html'".

- [ ] **Step 3: Implement the helper**

In `src/lib/html.ts`, export `escapeHtml` replacing `&`, `<`, `>`, `"` and `'`; export `renderBrandedEmail` returning a minimal table-free HTML document with the escaped app name, an `<img>` only when `logoUrl` is present, and the escaped body with newlines converted to `<br>`. No logging of body or URL.

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test src/lib/html.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Resolve branding per outbound message**

Add `logoUrl` and `appName` to `Outbound`. In `recipient.ts`, extend the `org_branding` select with `app_name, logo_url` and put both values on the email `Outbound`. Add a Vitest case in `recipient.test.ts` asserting a branded row produces those fields.

- [ ] **Step 6: Send HTML alongside text**

In `resend.ts`, import `renderBrandedEmail` and add `html: renderBrandedEmail(message)` to the Resend payload while keeping `text: message.body`. Add a test in `notifier.test.ts` asserting the helper is used for email messages. Confirm `.env.local` has `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` and that the rotated key is in place.

- [ ] **Step 7: Verify and commit**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: clean.

```bash
git add src/lib/html.ts src/lib/html.test.ts src/server/notifications/notifier.ts src/server/notifications/recipient.ts src/server/notifications/notifiers/resend.ts src/server/notifications/notifier.test.ts src/server/notifications/recipient.test.ts messages/en.json messages/ar.json
git commit -m "feat(notifications): branded HTML email with org logo"
```

---

### Task 7: Deviation log and full verification

**Files:**
- Modify: `docs/DECISIONS.md`

**Interfaces:**
- Consumes: the four deviations listed in the spec's section 7.
- Produces: decisions `D-021` through `D-024` under a `## 2026-11-18` heading (append to the existing one).

- [ ] **Step 1: Record the deviations**

Add one entry per deviation: global `theme_presets` without `org_id` (SPEC §5/§6); public `branding` bucket instead of private signed URLs (SPEC §3/§6/§11); HTML print sheets retained instead of `@react-pdf/renderer`; dynamic PWA manifest. Each entry names the spec section and the reason, following the existing entries' style.

- [ ] **Step 2: Run the full verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && supabase test db && pnpm build`
Expected: every command exits 0.

- [ ] **Step 3: Commit**

```bash
git add docs/DECISIONS.md
git commit -m "docs: record branding deviations and verify release"
```
