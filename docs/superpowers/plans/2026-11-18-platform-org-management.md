# Platform Org Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add platform-admin UI and actions to manage per-org lookups, Telegram config and general settings.

**Architecture:** Two new per-org tables with RLS; server actions behind `platformAdmin()`; three client cards on the existing org detail page.

**Tech Stack:** Next.js 15 server actions, Supabase/Postgres RLS, Zod, next-intl, shadcn/ui, Vitest, pgTAP.

**Spec:** `docs/superpowers/specs/2026-11-18-platform-org-management-design.md`

## Global Constraints

- RLS on every new table; every business table has `org_id`.
- No `any`; all user-visible strings via next-intl (`messages/en.json`, `messages/ar.json`).
- RTL logical utilities only; no `left`/`right`, `ml-`/`mr-`, `pl-`/`pr-`.
- Money via integer minor units; reuse `toMinor`.
- Regenerate `src/types/database.ts` after migration.
- Run `pnpm lint && pnpm typecheck && pnpm test` before done.

## Review Focus

- Empty token on save must keep the stored token, not clear it.
- Enum-label codes must be one of the existing enum values.
- Platform admin from org A must be able to edit org B; normal org members must not.
- Duplicate `(org_id, category, code)` must fail cleanly.
- Existing `/settings/organization` save must still work after the mapper extraction.

---

### Task 1: Database tables and types

**Files:**
- Create: `supabase/migrations/20261119000001_platform_org_management.sql`
- Create: `supabase/tests/0003_platform_org_management_test.sql`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Write migration creating `org_lookups` and `org_integrations`**

Columns per spec; indexes on `(org_id, category, sort_order)` and `(org_id, provider)`; `set_updated_at` triggers; RLS select for `org_id = auth_org()`, write for `auth_role() = 'org_admin'`.

- [ ] **Step 2: Write pgTAP tests for RLS, uniqueness and cross-org isolation**

Cover: member of org A cannot select/write org B rows; org_admin can write own; duplicate lookup code fails.

- [ ] **Step 3: Regenerate `src/types/database.ts`**

Run `pnpm gen:types` (or `supabase gen types typescript --local > src/types/database.ts`). If no local stack, add the two table types manually in the same shape as existing tables.

- [ ] **Step 4: Verify and commit**

Run `supabase test db` if local stack is available; otherwise note skipped. Commit.

### Task 2: Schemas and shared settings mapper

**Files:**
- Create: `src/schemas/platform-admin.ts`
- Create: `src/schemas/platform-admin.test.ts`
- Create: `src/lib/org-settings.ts`
- Modify: `src/server/actions/settings.ts:31-83`

**Interfaces:**
- Produces: `lookupSchema`, `integrationSchema`, `organizationUpdate(data, existingSettings)` returning the organization update payload.

- [ ] **Step 1: Write failing Vitest tests**

Assert: label category rejects unknown code; free-text category accepts any code; integration token empty allowed; `organizationUpdate` preserves unknown existing settings keys and converts `lateFee` to minor units.

- [ ] **Step 2: Run tests to verify they fail**

Run `pnpm test src/schemas/platform-admin.test.ts`.

- [ ] **Step 3: Implement schemas and mapper**

`lookupSchema` uses Zod enum for category and refine on code when category is a label category. `organizationUpdate` duplicates the payload built in `updateOrganizationSettingsAction` and is imported there instead.

- [ ] **Step 4: Run tests to verify they pass**

Run `pnpm test src/schemas/platform-admin.test.ts`.

- [ ] **Step 5: Commit**

### Task 3: Platform server actions

**Files:**
- Create: `src/server/actions/platform-org.ts`

**Interfaces:**
- Produces: `saveOrgSettingsAction`, `upsertLookupAction`, `deleteLookupAction`, `saveOrgIntegrationAction`, all `(prev: PlatformState, formData: FormData) => Promise<PlatformState>`.

- [ ] **Step 1: Implement the four actions**

Use `platformAdmin()` from `platform.ts` (export it), the schemas from Task 2, `org.settings` merge, `audit()` from `platform.ts` (export it), and `revalidatePath` on `/platform/organizations/[id]`. Empty Telegram token keeps the previous token.

- [ ] **Step 2: Verify and commit**

Run `pnpm typecheck`. Commit.

### Task 4: UI cards and org page wiring

**Files:**
- Create: `src/components/domain/platform-org-settings-form.tsx`
- Create: `src/components/domain/platform-lookups-manager.tsx`
- Create: `src/components/domain/platform-telegram-form.tsx`
- Modify: `src/app/[locale]/(platform)/platform/organizations/[id]/page.tsx`
- Modify: `messages/en.json`, `messages/ar.json`

- [ ] **Step 1: Add i18n keys**

Add `platform.settings`, `platform.lookups`, `platform.telegram` sections in both locales.

- [ ] **Step 2: Build the three client components**

Forms use `useActionState` and existing UI primitives. Lookups manager takes initial rows and category list; token field is password with masked placeholder.

- [ ] **Step 3: Fetch data and render cards in the org page**

Select `org_lookups` and `org_integrations` for the org; pass as props. Derive settings values using the same mapping as `/settings/organization`.

- [ ] **Step 4: Verify and commit**

Run `pnpm lint && pnpm typecheck && pnpm test`. Commit.

### Task 5: Final verification

- [ ] **Step 1: Run full checks**

`pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

- [ ] **Step 2: Report results and note skipped checks**

If Supabase local stack is unavailable, state that pgTAP and e2e were not run.
