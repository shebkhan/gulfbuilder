# v1 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship every remaining SPEC v1 surface — tenant portal, owner portal, white-label, platform console, document vault, meters, settings screens, printable documents — with testing and automation excluded by owner instruction.

**Architecture:** Each phase is one commit. Schema and policy work lands as new numbered migrations in `supabase/migrations/` (never editing applied ones) and is applied with `supabase db push --linked`. UI phases follow the repo's existing shape: Server Components read through the user-scoped Supabase client (so RLS governs), Server Actions in `src/server/actions/*` validate with Zod and call Postgres RPCs for multi-step financial work, strings live in `messages/en.json` + `messages/ar.json`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Supabase (Postgres + RLS + Storage), next-intl (en/ar), Tailwind + shadcn/ui, Zod.

**Spec:** `docs/superpowers/specs/2026-11-16-v1-completion-design.md` (design) and `docs/SPEC.md` (product). Read both before starting.

## Global Constraints

- **No tests.** The owner excluded Vitest, pgTAP, Playwright, CI and load/restore runs. Verification is `pnpm lint`, `pnpm typecheck`, a successful `supabase db push --linked`, and read-only SQL probes.
- **No automation.** No pg_cron schedules, no Edge Function senders, no scheduled report delivery, no email or WhatsApp sending. `notification_outbox` rows are written and left queued.
- **Money** is integer minor units + currency code; format only through `src/lib/money.ts`.
- **Dates** are `date` for business dates, `timestamptz` for events; format only through `src/lib/dates.ts`.
- **All user-visible strings** go through next-intl. Both `messages/en.json` and `messages/ar.json` get every new key.
- **RTL**: logical Tailwind utilities only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`). Never `left`/`right`/`ml-`/`mr`/`pl`/`pr`.
- **Server Components by default**; `use client` only where interactivity demands it.
- **RLS on every table.** Every new table gets `org_id`, `created_at`, `updated_at`, `created_by`, RLS enabled, policies, and an `(org_id, ...)` index on filtered columns.
- **Service-role client** (`src/lib/supabase/admin.ts`) only inside the `(platform)` route group and server actions it owns.
- **Regenerate types** after every migration: `pnpm gen:types` (`supabase gen types typescript --linked > src/types/database.ts`).
- **Commit message** style follows the repo: `feat(scope): what changed`.
- Migrations are numbered `202611160000NN_*.sql`; NN continues from the existing 21.

## Review Focus

The spec implies these input classes; each is pinned to the task that owns the code.

1. **A tenant who is also a staff member somewhere else** must see only the tenant surface for the org they are acting in — role routing is by the active membership, not by a global flag.
2. **A charge with no building** (a tenant or owner-less row) must not leak into the owner's scoped reads — scope joins must tolerate a null building.
3. **An owner with no `owners.user_id`** must see nothing in the owner portal rather than erroring.
4. **A file upload larger than the bucket limit or with an unexpected mime type** must fail the action and leave no `documents` row.
5. **A second organization with the same custom domain** must be rejected by a unique index, not by whichever row the middleware finds first.

---

### Task 1: Access foundations and platform schema

**Files:**
- Create: `supabase/migrations/20261116000022_access_platform.sql`
- Modify: `src/types/database.ts` (regenerated)

**Interfaces:**
- Consumes: `auth_org()`, `auth_role()`, `can_access_building(uuid)` from migrations 01/04/07.
- Produces (used by Tasks 2–8):
  - `public.is_platform_admin() returns boolean`
  - `public.tenant_lease_ids() returns setof uuid` — leases whose tenant has `tenants.user_id = auth.uid()`
  - `public.owner_building_ids() returns setof uuid` — buildings whose owner has `owners.user_id = auth.uid()`
  - `public.owner_ids() returns setof uuid` — the signed-in owner's owner rows
  - `public.org_feature_enabled(p_org uuid, p_feature text) returns boolean` — subscription → `plans.features ? p_feature`
  - tables `platform_admins(user_id uuid primary key)`, `plans(code text primary key)`, `subscriptions(org_id uuid primary key)`, `usage_snapshots(org_id uuid, taken_on date, units int, users int, storage_mb int, primary key (org_id, taken_on))`
  - `org_branding` gains `custom_domain_status text not null default 'none'`, `custom_domain_verified_at timestamptz`
  - private storage bucket `documents` with `{org_id}/{entity}/{id}/{file}` object policies

- [ ] **Step 1: Write the migration**

  Contents, in order:
  1. `create table if not exists public.platform_admins (user_id uuid primary key references auth.users(id), created_at timestamptz not null default now());`
  2. `create table if not exists public.plans (code text primary key, name text, limits jsonb not null default '{}', features jsonb not null default '{}', price_minor bigint, currency char(3));`
  3. `create table if not exists public.subscriptions (org_id uuid primary key references public.organizations(id), plan_code text references public.plans(code), status text, period_end date);`
  4. `create table if not exists public.usage_snapshots (org_id uuid not null references public.organizations(id), taken_on date not null, units int not null default 0, users int not null default 0, storage_mb int not null default 0, primary key (org_id, taken_on));`
  5. `alter table public.org_branding add column if not exists custom_domain_status text not null default 'none';` and `add column if not exists custom_domain_verified_at timestamptz;`
  6. The five helper functions above, each `security definer set search_path = public`, reading only `auth.uid()`.
  7. RLS on the four new tables: `platform_admins` is service-role only (no authenticated policy); `plans` select to authenticated; `subscriptions` and `usage_snapshots` select where `org_id = auth_org()`, write to `org_admin`.
  8. Storage bucket + object policies:
     ```sql
     insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;
     create policy "documents_read" on storage.objects for select to authenticated using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth_org()::text);
     create policy "documents_write" on storage.objects for insert to authenticated with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth_org()::text);
     ```
  9. **Policy rewrites.** For every table below, `drop policy if exists <name>` then recreate a select policy that admits staff unchanged and adds the scoped branches:
     - staff read = `auth_role() in ('org_admin','manager','accountant','caretaker')`
     - owner read = row's building is in `owner_building_ids()`, or `owner_id in (select owner_ids())`, or the row's lease is in `owner_building_ids()`'s leases
     - tenant read = the row's lease is in `tenant_lease_ids()`
     Tables: `charges`, `payments`, `payment_allocations`, `tenant_credits`, `cheques`, `deposits`, `deposit_transactions`, `expenses`, `maintenance_requests`, `maintenance_events`, `meters`, `meter_readings`, `inspections`, `documents`, `owner_statements`, `owner_payouts`, `owner_expense_approvals`, `owner_ledger_entries`, `journals`, `journal_lines`, `accounts`, `accounting_periods`, `report_definitions`, `report_snapshots`.
     - Owner may update only their own row in `owner_expense_approvals` (status pending→approved|rejected, `decided_by = auth.uid()`, `decided_at = now()`).
     - Tenant may insert `maintenance_requests` for their own lease and `payments` with `status = 'pending_confirmation'` for their own tenant id; no update or delete on either.

- [ ] **Step 2: Apply and regenerate types**

  Run: `supabase db push --linked` then `pnpm gen:types`
  Expected: migration applies cleanly; `src/types/database.ts` gains the four new tables and the two new `org_branding` columns.

- [ ] **Step 3: Probe the new policies**

  Run read-only SQL against the linked project: confirm `select public.tenant_lease_ids()`, `public.owner_building_ids()`, `public.is_platform_admin()` execute without error and return rows only for the signed-in identity; confirm `information_schema.tables` lists `platform_admins`, `plans`, `subscriptions`, `usage_snapshots`.
  Expected: no error; the helper functions return empty sets for a session with no tenant/owner rows.

- [ ] **Step 4: Typecheck and commit**

  Run: `pnpm typecheck && pnpm lint`
  Expected: clean.
  ```bash
  git add supabase/migrations/20261116000022_access_platform.sql src/types/database.ts
  git commit -m "feat(db): platform schema, tenant/owner scoped RLS, documents bucket"
  ```

---

### Task 2: Tenant portal

**Files:**
- Create: `src/app/[locale]/(portal)/layout.tsx`, `page.tsx`, `statement/page.tsx`, `payments/page.tsx`, `requests/page.tsx`, `documents/page.tsx`
- Create: `src/components/domain/portal-shell.tsx`, `src/components/domain/payment-proof-form.tsx`, `src/components/domain/tenant-request-form.tsx`
- Create: `src/server/actions/portal.ts`, `src/server/queries/tenant-portal.ts`
- Modify: `messages/en.json`, `messages/ar.json`
- Modify: `src/app/[locale]/(app)/layout.tsx` (role-based landing)

**Interfaces:**
- Consumes: `tenant_lease_ids()`, `documents` bucket, `create_maintenance_request` RPC, `record_payment` RPC is **not** used by tenants (they post `pending_confirmation` rows instead).
- Produces:
  - `src/server/queries/tenant-portal.ts` → `getTenantPortalData(client)` returning `{ leases, charges, payments, credits, requests, documents }` for the signed-in tenant.
  - `src/server/actions/portal.ts` → `submitPaymentProofAction(prev, formData): Promise<{ error?: string; ok?: string }>`, `createTenantRequestAction(prev, formData): Promise<{ error?: string; ok?: string }>`
  - `PortalShell` props: `{ children, tenantName, locale }`

- [ ] **Step 1: Build the portal shell and layout**

  `PortalShell` is mobile-first: header with the org/app name, a bottom navigation bar (Home, Statement, Payments, Requests, Documents), `min-h-dvh`, safe-area padding. The layout resolves the signed-in user, reads their `org_members` row, redirects `tenant` to `/{locale}/portal`, and for any other role redirects to `/{locale}/dashboard`. It does not use `AppShell`. The layout also calls `org_feature_enabled(org_id, 'tenant_portal')` and redirects to `/{locale}/dashboard` when the organization's plan does not include the tenant portal (SPEC §10 feature flags).

- [ ] **Step 2: Write the portal read model**

  `src/server/queries/tenant-portal.ts` uses the user-scoped client and RLS does the filtering: select the tenant row for `auth.uid()`, then that tenant's leases, charges, payments, credits, maintenance requests and `documents` rows. Return plain objects; no service-role reads.

- [ ] **Step 3: Write the portal pages**

  - `page.tsx`: lease summary (unit/building, rent, dates, status), next charge due, open requests, last payment.
  - `statement/page.tsx`: charges with status and due date, payments with receipt numbers, credit balance.
  - `payments/page.tsx`: payment history + `PaymentProofForm`.
  - `requests/page.tsx`: request list + `TenantRequestForm` (title, description, priority, category).
  - `documents/page.tsx`: receipts, contracts and other `documents` rows for the tenant's lease, each linking to a signed URL.

- [ ] **Step 4: Write the portal actions**

  `submitPaymentProofAction` validates with Zod (`amount` positive, `method` in `cash|bank_transfer|cheque|card|online`, `receivedOn` ISO date, `note` optional), uploads the file to `documents` at `{org_id}/payments/{tenant_id}/{uuid}-{filename}`, inserts a `payments` row with `status = 'pending_confirmation'` and `proof_path`, and returns `{ ok: "submitted" }`. A failed upload returns an error and writes no row. `createTenantRequestAction` validates and calls the existing `create_maintenance_request` RPC for the tenant's lease.

- [ ] **Step 5: Route sign-in by role**

  In `src/server/actions/auth.ts` `signInAction`, after a successful sign-in, read the user's membership role and redirect `tenant` → `/{locale}/portal`, `owner` → `/{locale}/owner`, otherwise `/{locale}/dashboard`.

- [ ] **Step 6: Add translations**

  Add `portal.*` keys to both message files: nav labels, home sections, statement columns, payment form labels, request form labels, empty states.

- [ ] **Step 7: Typecheck and commit**

  Run: `pnpm typecheck && pnpm lint`
  Expected: clean.
  ```bash
  git add src/app/[locale]/\(portal\) src/components/domain src/server/actions/portal.ts src/server/queries/tenant-portal.ts src/server/actions/auth.ts messages
  git commit -m "feat(portal): tenant portal with dues, statements, payments and requests"
  ```

---

### Task 3: Owner portal

**Files:**
- Create: `src/app/[locale]/(owner)/layout.tsx`, `page.tsx`, `buildings/page.tsx`, `buildings/[id]/page.tsx`, `rent-roll/page.tsx`, `receivables/page.tsx`, `statements/page.tsx`, `statements/[id]/page.tsx`, `payouts/page.tsx`, `approvals/page.tsx`, `documents/page.tsx`
- Create: `src/components/domain/owner-shell.tsx`
- Create: `src/server/actions/owner-portal.ts`, `src/server/queries/owner-portal.ts`
- Create: `supabase/migrations/20261116000023_business_rules.sql` (`issue_owner_statement`)
- Modify: `messages/en.json`, `messages/ar.json`

**Interfaces:**
- Consumes: `owner_building_ids()`, `owner_ids()`, `owner_statements`, `owner_payouts`, `owner_expense_approvals`, `generate_owner_statement` RPC (Task 1 policies already scope them).
- Produces:
  - `src/server/actions/owner-portal.ts` → `decideExpenseApprovalAction(prev, formData)`, `issueOwnerStatementAction(prev, formData)`
  - `src/server/queries/owner-portal.ts` → `getOwnerDashboard(client)`, `getOwnerBuildings(client)`, `getOwnerRentRoll(client)`, `getOwnerReceivables(client)`, `getOwnerStatements(client)`, `getOwnerPayouts(client)`, `getOwnerApprovals(client)`, `getOwnerDocuments(client)`

- [ ] **Step 1: Add the `issue_owner_statement` RPC**

  In `20261116000023_business_rules.sql`: `public.issue_owner_statement(p_statement_id uuid) returns uuid`, `security definer`. Validates the statement belongs to `auth_org()` and has status `draft` or `review`; locks it (`status = 'issued'`, `issued_at = now()`, `issued_by = auth.uid()`); posts the management-fee journal through the existing `post_journal` RPC (SPEC §7.8) when the owner has a management fee; returns the statement id. Raises if the statement is already issued.

- [ ] **Step 2: Build the owner shell and layout**

  `OwnerShell` reuses `AppShell` primitives (`SidebarNav`, `visibleNav`) with an `OWNER_NAV` item list (Dashboard, Buildings, Rent roll, Receivables, Statements, Payouts, Approvals, Documents) — all read-only capability `reports.read`. The layout redirects any non-`owner` role to `/{locale}/dashboard`, and redirects to `/{locale}/dashboard` when `org_feature_enabled(org_id, 'owner_portal')` is false.

- [ ] **Step 3: Write the owner read model and pages**

  Each query reads through the user-scoped client so the Task 1 policies scope the rows to the signed-in owner's buildings. Pages:
  - `page.tsx`: occupancy, collected vs expected, arrears, NOI, upcoming cheques, open maintenance, expiring leases, next payout.
  - `buildings/page.tsx` + `buildings/[id]/page.tsx`: the owner's buildings and per-building KPIs.
  - `rent-roll/page.tsx`: unit, tenant, dates, rent, deposit, paid-to-date, status.
  - `receivables/page.tsx`: aged buckets 0-30 / 31-60 / 61-90 / 90+.
  - `statements/page.tsx` + `statements/[id]/page.tsx`: statement list and detail with lines and totals.
  - `payouts/page.tsx`: payout history.
  - `approvals/page.tsx`: pending expense approvals with approve/reject.
  - `documents/page.tsx`: the owner's documents.

- [ ] **Step 4: Write the owner actions**

  `decideExpenseApprovalAction` updates the approval row the owner owns (RLS restricts it to their own row) and writes `decided_by`/`decided_at`/`note`. `issueOwnerStatementAction` calls the new RPC.

- [ ] **Step 5: Add translations**

  Add `owner.*` keys to both message files.

- [ ] **Step 6: Typecheck and commit**

  Run: `supabase db push --linked && pnpm gen:types && pnpm typecheck && pnpm lint`
  Expected: clean.
  ```bash
  git add src/app/[locale]/\(owner\) src/components/domain/owner-shell.tsx src/server/actions/owner-portal.ts src/server/queries/owner-portal.ts supabase/migrations/20261116000023_business_rules.sql src/types/database.ts messages
  git commit -m "feat(owner): owner portal with portfolio, statements, payouts and approvals"
  ```

---

### Task 4: Document vault, meters and settings screens

**Files:**
- Create: `src/app/[locale]/(app)/documents/page.tsx`, `src/app/[locale]/(app)/meters/page.tsx`
- Create: `src/app/[locale]/(app)/settings/organization/page.tsx`, `settings/branding/page.tsx`, `settings/accounting/page.tsx`, `settings/notifications/page.tsx`, `settings/audit/page.tsx`, `settings/export/page.tsx`
- Create: `src/components/domain/document-upload-form.tsx`, `meter-form.tsx`, `organization-settings-form.tsx`, `branding-form.tsx`, `notification-template-form.tsx`
- Create: `src/server/actions/documents.ts`, `src/server/actions/meters.ts`, `src/server/actions/settings.ts`, `src/server/actions/export.ts`
- Create: `supabase/migrations/20261116000024_ops_rules.sql` (`mark_overdue_and_late_fees`)
- Modify: `src/components/domain/nav-items.ts`, `messages/en.json`, `messages/ar.json`

**Interfaces:**
- Consumes: `documents` bucket and table, `meters`/`meter_readings` tables, `notification_templates`, `notification_outbox`, `accounting_periods`, `close_period`/`reopen_period` RPCs.
- Produces:
  - `src/server/actions/documents.ts` → `uploadDocumentAction(prev, formData)`, `getDocumentUrlAction(documentId)`
  - `src/server/actions/meters.ts` → `createMeterAction(prev, formData)`, `addMeterReadingAction(prev, formData)`
  - `src/server/actions/settings.ts` → `updateOrganizationSettingsAction`, `updateBrandingAction`, `updateNotificationTemplateAction`, `closePeriodAction`, `reopenPeriodAction`, `runOverdueSweepAction`

- [ ] **Step 1: Add the `mark_overdue_and_late_fees` RPC**

  In `20261116000024_ops_rules.sql`: `public.mark_overdue_and_late_fees() returns integer`, `security definer`. Marks `pending`/`partial` charges whose `due_date + grace_days` (from `organizations.settings.grace_days`, default 0) is before today as `overdue`; applies the org late-fee rule (`settings.late_fee` amount, `settings.late_fee_type` in `flat|percent`) once per charge, creating a `late_fee` charge with `period_start = due_date`; writes a `notification_outbox` row for the tenant. Returns the number of charges marked.

- [ ] **Step 2: Build the documents vault**

  `/documents` lists `documents` rows for the org with kind, entity, expiry and a download button. `uploadDocumentAction` accepts kind, entity type, entity id, optional expiry date and a file, uploads to `{org_id}/{entity_type}/{entity_id}/{uuid}-{filename}`, then inserts the `documents` row. `getDocumentUrlAction` returns a signed URL for a row the caller may read. Upload limit: 10 MB; reject other mime types and leave no row on failure.

- [ ] **Step 3: Build the meters screen**

  `/meters` lists meters with their latest reading; `createMeterAction` adds a meter (kind `electricity|water|gas`, building, optional unit, meter number); `addMeterReadingAction` appends a reading with date and value; the page shows consumption history per meter as the difference between consecutive readings.

- [ ] **Step 4: Build the settings screens**

  - `settings/organization`: name, legal name, base currency, default locale, timezone, and `settings` fields (late fee, late fee type, grace days, tax rate, reminder days, revenue recognition `on_due|straight_line_monthly`).
  - `settings/branding`: app name, logo URL, favicon URL, primary/secondary colour, font family, terminology JSON (a key→value map merged over translations) and custom domain request (writes `org_branding.custom_domain`, sets status `pending`).
  - `settings/accounting`: accounting periods with close/reopen buttons and a "run overdue sweep" button calling the new RPC.
  - `settings/notifications`: notification templates per event/channel/locale and the outbox log.
  - `settings/audit`: the `audit_log` rows for the organization (SPEC §8 A4), newest first, with table, action, actor and timestamp.
  - `settings/export`: full data export as CSV (SPEC §8 A5) — one file per dataset (tenants, leases, charges, payments, journal lines) generated server-side through the existing `src/lib/csv.ts` helpers and streamed back as a download.
  Add `documents` and `meters` to `nav-items.ts` with the right capabilities.

- [ ] **Step 5: Add translations**

  Add `documents.*`, `meters.*`, `settings.*` keys to both message files.

- [ ] **Step 6: Typecheck and commit**

  Run: `supabase db push --linked && pnpm gen:types && pnpm typecheck && pnpm lint`
  Expected: clean.
  ```bash
  git add src/app/[locale]/\(app\) src/components/domain src/server/actions supabase/migrations/20261116000024_ops_rules.sql src/types/database.ts messages
  git commit -m "feat(app): document vault, meters and settings screens"
  ```

---

### Task 5: White-label branding and domains

**Files:**
- Create: `src/lib/white-label.ts`, `src/app/manifest.ts`, `public/sw.js`, `public/icons/icon.svg`
- Modify: `src/middleware.ts`, `src/app/[locale]/layout.tsx`

**Interfaces:**
- Consumes: `org_branding` (Task 1 columns), `organizations.slug`.
- Produces:
  - `src/lib/white-label.ts` → `resolveOrgByHost(host: string): Promise<{ orgId: string; slug: string } | null>`, `getBranding(orgId: string): Promise<Branding | null>` where `Branding = { appName, logoUrl, primaryColor, secondaryColor, fontFamily, terminology, customDomain }`
  - `src/middleware.ts` forwards `x-org-id` and `x-org-slug` request headers.
  - `src/app/manifest.ts` → the PWA manifest (name, start_url, `display: standalone`, theme colour from branding, SVG icon).
  - `public/sw.js` → offline shell: cache-first for the app shell, network-only for API and Supabase traffic.

- [ ] **Step 1: Write the host resolver**

  `resolveOrgByHost` strips the port, lowercases, and looks up `org_branding.custom_domain` (verified) first, then `{slug}.{appHost}` where `appHost` comes from `NEXT_PUBLIC_APP_HOST` (default `localhost`). Cache lookups in a module-level `Map` with a 60-second TTL. Return null when nothing matches so the request falls through to normal routing. The existing unique index on `org_branding.custom_domain` is what stops two organizations claiming one domain — the branding form must surface that conflict as a validation error rather than a generic failure.

- [ ] **Step 2: Wire the middleware**

  After `updateSession`, resolve the org from the host header. When an org is resolved, set `x-org-id` and `x-org-slug` on the request headers used downstream and on the response, so the layout can read branding without a second lookup.

- [ ] **Step 3: Apply branding in the locale layout**

  Read the org id from the request headers, load the branding row, and set `--brand-primary`, `--brand-secondary` and `--brand-font` inline on the `<html>` element (falling back to the defaults in `globals.css` when no org is resolved). Merge `terminology` over the base messages before passing them to `NextIntlClientProvider`, so terminology overrides work in server and client components alike.

- [ ] **Step 4: Add the PWA manifest and offline shell**

  `src/app/manifest.ts` exports the manifest object: `name` and `short_name` from the branding app name (falling back to a default), `start_url` `/{locale}/dashboard`, `display: 'standalone'`, `background_color` and `theme_color` from the brand variables, `icons` pointing at `/icons/icon.svg` (`purpose: 'any maskable'`). Register the manifest in the locale layout metadata (`manifest: '/manifest.webmanifest'`). `public/sw.js` caches the app shell on install, serves cached shell assets when offline, and never caches Supabase API traffic — API calls must fail loudly rather than serve stale money data.

- [ ] **Step 5: Typecheck and commit**

  Run: `pnpm typecheck && pnpm lint`
  Expected: clean.
  ```bash
  git add src/lib/white-label.ts src/app/manifest.ts public/sw.js public/icons src/middleware.ts "src/app/[locale]/layout.tsx"
  git commit -m "feat(branding): host-to-organization resolution, brand variables, terminology and PWA shell"
  ```

---

### Task 6: Platform console

**Files:**
- Create: `src/app/[locale]/(platform)/layout.tsx`, `page.tsx`, `organizations/[id]/page.tsx`, `market-packs/page.tsx`
- Create: `src/components/domain/platform-shell.tsx`, `organization-admin-form.tsx`, `market-pack-form.tsx`
- Create: `src/server/actions/platform.ts`
- Modify: `messages/en.json`, `messages/ar.json`

**Interfaces:**
- Consumes: `is_platform_admin()`, `platform_admins`, `plans`, `subscriptions`, `usage_snapshots`, `market_packs`, `audit_log`.
- Produces:
  - `src/server/actions/platform.ts` → `createOrganizationAction`, `setOrganizationPlanAction`, `recordUsageSnapshotAction`, `updateMarketPackAction`, `impersonateAction` — all use the service-role client and write an `audit_log` row.

- [ ] **Step 1: Build the platform layout**

  Resolve the signed-in user with the user-scoped client, check `is_platform_admin()`, and redirect to `/{locale}/dashboard` when the check fails. Below the layout, all reads use the service-role client.

- [ ] **Step 2: Build the console pages**

  - `page.tsx`: organizations with plan, status, unit count and MRR; usage totals.
  - `organizations/[id]/page.tsx`: organization detail — plan and limits editor (the plan's `features` map is what `org_feature_enabled` reads, so toggling `owner_portal`, `tenant_portal`, `analytics` or `custom_domain` here switches those surfaces on and off), subscription status, members, usage snapshots, and the impersonate button.
  - `market-packs/page.tsx`: list market packs and edit a pack's rules JSON.

- [ ] **Step 3: Write the platform actions**

  Each action validates with Zod, checks `is_platform_admin()` through the service-role client, performs the change, and inserts an `audit_log` row (`table_name`, `action`, `old_data`, `new_data`, `actor_id`). `impersonateAction` records `action = 'impersonate'` with the target org and user before switching the active organization.

- [ ] **Step 4: Add translations**

  Add `platform.*` keys to both message files.

- [ ] **Step 5: Typecheck and commit**

  Run: `pnpm typecheck && pnpm lint`
  Expected: clean.
  ```bash
  git add src/app/[locale]/\(platform\) src/components/domain src/server/actions/platform.ts messages
  git commit -m "feat(platform): super-admin console with plans, usage and audited impersonation"
  ```

---

### Task 7: Printable documents

**Files:**
- Create: `src/app/[locale]/print/layout.tsx`, `print/receipt/[id]/page.tsx`, `print/statement/[id]/page.tsx`, `print/owner-statement/[id]/page.tsx`, `print/contract/[id]/page.tsx`
- Create: `src/components/domain/print-document.tsx`
- Modify: `messages/en.json`, `messages/ar.json`

**Interfaces:**
- Consumes: `payments`, `charges`, `leases`, `owner_statements`, `org_branding` — all through the user-scoped client so RLS governs what each role may print.
- Produces: `PrintDocument` props `{ title, orgName, lines, totals, footer }` — renders a bordered sheet with a print button hidden by `@media print`.

- [ ] **Step 1: Build the print layout**

  A bare layout (no app shell) with print CSS: `@page { size: A4; margin: 15mm }`, white background, black text, no shadows, and a fixed "Print / Save as PDF" button hidden in print.

- [ ] **Step 2: Build the four documents**

  - `print/receipt/[id]`: receipt number, tenant, amount, method, date, allocations.
  - `print/statement/[id]`: tenant statement — charges, payments, credit balance, period.
  - `print/owner-statement/[id]`: owner statement — opening, collections, expenses, fees, payouts, closing.
  - `print/contract/[id]`: bilingual lease contract — parties, unit, dates, rent, deposit, terms.
  Each page renders its own copy in the requested locale and links the other language.

- [ ] **Step 3: Add translations**

  Add `print.*` keys to both message files.

- [ ] **Step 4: Typecheck and commit**

  Run: `pnpm typecheck && pnpm lint`
  Expected: clean.
  ```bash
  git add "src/app/[locale]/print" src/components/domain/print-document.tsx messages
  git commit -m "feat(print): printable receipts, statements and contracts"
  ```

---

### Task 8: Documentation and hardening notes

**Files:**
- Create: `docs/admin-guide.md`, `docs/runbook.md`, `docs/import-templates/owners.csv`, `docs/import-templates/buildings.csv`, `docs/import-templates/units.csv`, `docs/import-templates/tenants.csv`
- Modify: `docs/DECISIONS.md`

**Interfaces:**
- Consumes: everything shipped above.
- Produces: operator-facing documentation; no code interfaces.

- [ ] **Step 1: Write the admin guide**

  How to create an organization, invite users and assign roles, import property data, activate a lease, record a payment, clear or bounce a cheque, handle a deposit, close a period, issue an owner statement, and use the tenant and owner portals. Include the demo credentials note (local only) and the import CSV column order matching `src/lib/import-rows.ts`.

- [ ] **Step 2: Write the runbook**

  Deploy steps, migrations, environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_HOST`), backup and restore pointers, and the known gaps left by this scope: no test suites, no scheduled jobs, no notification sender, no bank reconciliation.

- [ ] **Step 3: Write the import templates**

  CSV headers matching the columns the existing import form accepts for owners, buildings, units and tenants.

- [ ] **Step 4: Log the deviations**

  Add to `docs/DECISIONS.md`: D-014 printable HTML instead of `@react-pdf/renderer`; D-015 platform admins as a separate table rather than a `member_role` value; D-016 tenant and owner self-scope policies; D-017 no sender for `notification_outbox` while automation is excluded.

- [ ] **Step 5: Final verification and commit**

  Run: `pnpm lint && pnpm typecheck && supabase db push --linked`
  Expected: clean, and the remote database already up to date.
  ```bash
  git add docs
  git commit -m "docs: admin guide, runbook, import templates and deviation log"
  ```
