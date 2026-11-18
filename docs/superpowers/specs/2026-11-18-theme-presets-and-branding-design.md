# Theme presets and organization branding — design

Date: 2026-11-18 · Status: approved design (brainstorming complete) · Target milestone: M6 (White-label and platform)

## 1. Context and goals

`org_branding` already stores `app_name`, `logo_url`, `favicon_url`, `primary_color`, `secondary_color`, `font_family`, `terminology`, `custom_domain` and `email_from`. Host-to-organization resolution in middleware passes branding through the `x-brand` header, and the root layout applies colors/font as CSS variables.

Two gaps block real white-label use:

- There is no super-admin way to define a theme baseline for new organizations.
- `logo_url` is editable but **never rendered** — not in the app shell, login, PWA manifest, emails or print documents.

Goal: a super-admin preset catalog, org-level preset selection and logo upload, and rendering of the org logo on every v1 surface named in `SPEC.md` §10 (header, emails, PDFs/print, plus login and PWA).

## 2. Decisions made during brainstorming

| Decision | Choice |
|---|---|
| Scope | Org + platform presets only. No per-owner personalization layer. |
| Preset contents | Colors and font family only — not logo, app name, terminology or sender. |
| Preset lifetime | Snapshot: selecting a preset copies values into `org_branding`; later preset edits do not propagate. |
| Logo supply | Supabase Storage upload, not a manually edited URL. |
| Logo surfaces | App shell header, login page, PWA manifest, notification email, all print documents. |
| Email | Add an HTML body with a branded header and logo; keep the existing plain-text body as fallback. |

## 3. Data and storage

### 3.1 `theme_presets` table

New migration in `supabase/migrations/`, following the `market_packs` precedent (global table, service-role writes):

- `code text primary key`, `name text not null`, `primary_color text not null`, `secondary_color text not null`, `font_family text not null`, `is_default boolean not null default false`, `created_at`, `updated_at`, `created_by`.
- Check constraints: colors match `^#[0-9a-fA-F]{6}$`; font family is at most 80 characters (matching the existing `brandingSchema` limit) and restricted to letters, digits, spaces, commas, hyphens and single quotes so it cannot break out of the CSS variable that consumes it.
- Partial unique index allowing at most one `is_default` row. The default preset is the baseline for newly created organizations (see 4.1).
- RLS enabled: `select` to `authenticated`; no client write policies. Writes go through the service-role client used by the `(platform)` route group only.
- pgTAP: RLS select allowed, direct client insert/update/delete denied, one-default constraint.

No `preset_id` column is added to `org_branding` — selection is a snapshot of `primary_color`, `secondary_color` and `font_family`.

### 3.2 `branding` storage bucket

- New bucket `branding` marked public. Paths: `{org_id}/logo/<uuid>-<safe-name>` and `{org_id}/favicon/<uuid>-<safe-name>`.
- Public `select` is required because login, PWA, email and print cannot use short-lived signed URLs.
- `insert`/`update`/`delete` policies require `authenticated`, `(storage.foldername(name))[1] = auth_org()::text` and `auth_role() = 'org_admin'`.
- pgTAP: org A cannot write to org B's prefix; non-admin roles cannot write; public read works.

### 3.3 `org_branding` fields

No new columns. `logo_url` and `favicon_url` hold the public object URLs produced by the upload action. Existing Zod validation is tightened to http(s) URLs with the existing 300-character limit.

## 4. Admin surfaces

### 4.1 Super-admin

- New page `src/app/[locale]/(platform)/platform/themes/page.tsx`, modeled on `market-packs/page.tsx`: list presets, edit forms, create form.
- New `PLATFORM_NAV` item in `src/components/domain/nav-items.ts` (capability `platform.admin`).
- New actions in `src/server/actions/platform.ts`: upsert preset, set default. Zod-validates colors/font, uses the service-role client, and writes `audit_log` rows like the other platform actions.
- Extend `createOrganizationAction` so the `org_branding` row it inserts starts with the default preset's colors/font. If no default preset exists, leave those fields null as today.
- All strings via next-intl in `messages/en.json` and `messages/ar.json`.

### 4.2 Org admin

- Extend `src/app/[locale]/(app)/settings/branding/page.tsx` and `src/components/domain/branding-form.tsx`: a preset `<Select>` at the top copies colors/font into the existing form fields with react-hook-form `setValue`, leaving them editable before save.
- Replace the manual logo/favicon URL inputs with file inputs. New `uploadBrandAssetAction` in `src/server/actions/settings.ts` follows `uploadDocumentAction`: verify `File`, PNG/JPEG/WebP only, 2 MB limit, sanitized filename, upload to the org-scoped path, then store the public URL in `org_branding`.
- Page and action stay gated by `settings.write` (org_admin) via `getOrgContext`/`can`.

## 5. Rendering surfaces

- Factor the `x-brand` header decode out of `src/app/[locale]/layout.tsx` into a `getBrand()` helper in `src/lib/white-label.ts`; reuse it in the login page and PWA manifest.
- Add an optional `logoUrl` prop to `AppShell` and pass the brand logo from the `(app)`, `owner` and `portal` layouts. The platform console keeps the default mark.
- Render the logo on `src/app/[locale]/(auth)/login/page.tsx`.
- Make `src/app/manifest.ts` dynamic: name, `theme_color` and `background_color` from the brand, plus the logo as an icon entry. Caveat: browsers expect fixed pixel sizes for raster manifest icons, so the bundled SVG may remain the installed icon.
- Add `logoUrl` to `PrintDocument`; pass it from the four print pages (`contract`, `receipt`, `statement`, `owner-statement`), which already query `org_branding` for `app_name`.
- Add `logoUrl` and `appName` to `Outbound` in `src/server/notifications/notifier.ts`, resolve them in `recipient.ts`, and send `html` with an escaped body and logo header alongside `text` in `notifiers/resend.ts`. No body or URL is logged.

## 6. Tests

- Vitest: color/font Zod validation, HTML escaping in the email template, preset snapshot behavior.
- pgTAP: `theme_presets` RLS and default constraint, `branding` bucket policies including cross-tenant write denial.
- Playwright in `en` and `ar`: super-admin creates a preset → org admin selects it → logo upload → logo visible in app shell and print preview.
- Verification before completion: `pnpm lint && pnpm typecheck && pnpm test && supabase test db`, plus `pnpm build`.

## 7. Deviations to record in `docs/DECISIONS.md`

1. Global `theme_presets` table has no `org_id`, matching the existing `market_packs` exception to the "every table has org_id" rule.
2. New `branding` bucket is public rather than private with signed URLs (`SPEC.md` §3, §6, §11), because login, email, PWA and print need a stable URL.
3. Print documents use the existing HTML `window.print()` sheet rather than `@react-pdf/renderer`, following the current code.
4. `src/app/manifest.ts` becomes dynamic to read branding.

## 8. Build order

1. Migration, regenerated `src/types/database.ts`, pgTAP tests.
2. Super-admin preset list/editor and actions, default-preset seeding in org creation, nav item, translations.
3. Logo upload action and branding-form changes.
4. Rendering: shared `getBrand()`, app shell, login, manifest, print pages.
5. HTML email: notifier type, recipient resolution, Resend payload, tests.
6. `DECISIONS.md` entries, full verification.

## 9. Non-goals and open risks

- No per-owner/per-user theming, no dark mode or density controls, no SVG upload.
- The Resend key belongs only in `.env.local` (gitignored); the key shared in chat must be rotated. `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` are required for email delivery.
- Changing a preset does not restyle organizations that already selected it — this is intentional snapshot behavior.
- Work targets M6; the repo's milestone DoD rule still applies before treating the milestone as complete.
