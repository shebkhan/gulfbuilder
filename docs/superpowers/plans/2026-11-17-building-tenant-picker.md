# Building + Tenant Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tenant dropdowns in the lease, payment and cheque forms with a read-only textbox that opens a building → tenant picker, loading tenants on demand for the selected building.

**Architecture:** A reusable client component holds building selection and a tenant list fetched via a server action on building change. Tenant identity remains a plain string id in react-hook-form. Pages stop sending all tenants; they send only a scoped building list. Two PostgREST queries (unit leases + room leases) are merged in a pure helper.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, shadcn/ui (Radix Select + Dialog), react-hook-form + Zod, next-intl, Supabase (RLS), Vitest.

**Spec:** `/Users/shahbaz/.opencode/plan/2026-11-17-building-tenant-picker-design.md`

## Global Constraints

- TypeScript strict; no `any`. kebab-case files, PascalCase components, snake_case DB.
- All user-visible strings through next-intl (`messages/en.json`, `messages/ar.json`). RTL-safe logical Tailwind utilities only.
- Server data access via the user's Supabase session client; RLS applies. No service-role usage outside allowed paths. No new dependencies, no DB migration.
- Shared types: `PickerTenant = { id: string; full_name: string; phone: string | null }`, `BuildingOption = { id: string; code: string; name: string }`.
- Verify with `pnpm lint && pnpm typecheck && pnpm test` before completion.

## Review Focus

- Building switch must clear a previously selected tenant and the dependent `leaseId`/allocations — test via form change handlers in Tasks 4–6.
- Only active leases in the selected building count — server action query in Task 2 + helper test in Task 1.
- Duplicate tenants (multiple active leases in one building) must appear once — Task 1 test.
- No tenant data before a building is chosen — component initial state in Task 3.
- Deep link `?tenantId=` must still show a selected tenant — Task 4.

---

### Task 1: Tenant merge helper + test

**Files:** Create `src/lib/tenant-picker.ts`, `src/lib/tenant-picker.test.ts`

**Interfaces:** Produces `mergeTenantGroups(...groups: PickerTenant[][]): PickerTenant[]` and exported `PickerTenant`, `BuildingOption` types.

- [ ] **Step 1: Write failing test** asserting dedupe by `id` across two groups, sort by `full_name`, and empty input → `[]`.
- [ ] **Step 2:** Run `pnpm test -- src/lib/tenant-picker.test.ts`; expect FAIL (module missing).
- [ ] **Step 3:** Implement helper: flatten, dedupe by id (Map), sort by `full_name.localeCompare`.
- [ ] **Step 4:** Run test; expect PASS.
- [ ] **Step 5:** Commit `feat: add tenant merge helper`.

### Task 2: Server action `getTenantsForBuilding`

**Files:** Modify `src/server/actions/tenants.ts`

**Interfaces:** Produces `getTenantsForBuilding(buildingId: string): Promise<PickerTenant[]>`.

- [ ] **Step 1:** Add action: `getOrgContext()`; return `[]` if null. Query active leases joined to `tenants!inner(id, full_name, phone, deleted_at)` and `units!inner(building_id)` filtered by `units.building_id`; second query via `rooms!inner(units!inner(building_id))` filtered by `rooms.units.building_id`. Filter `tenants.deleted_at` null.
- [ ] **Step 2:** Map both result sets to `PickerTenant[]`, pass through `mergeTenantGroups`, return.
- [ ] **Step 3:** Run `pnpm typecheck`; expect PASS.
- [ ] **Step 4:** Commit `feat: add getTenantsForBuilding action`.

### Task 3: Picker component + i18n labels

**Files:** Create `src/components/domain/building-tenant-picker.tsx`; modify `messages/en.json`, `messages/ar.json`

**Interfaces:** Consumes `getTenantsForBuilding`, `BuildingOption`, `PickerTenant`. Produces `BuildingTenantPicker` with props `{ buildings: BuildingOption[]; value: string; initialTenant?: (PickerTenant & { buildingId: string }) | null; onChange: (tenantId: string, tenant: PickerTenant | null) => void; labels: { building, selectBuilding, tenant, selectTenant, loading, empty, error, choose: string } }`.

- [ ] **Step 1:** Add `tenantPicker` namespace to both message files with keys above (EN + AR).
- [ ] **Step 2:** Implement component: read-only `Input` trigger showing selected name (derived from `value` against loaded tenants or `initialTenant`), opens Radix `Dialog`. Dialog holds building `Select`; on change calls action, shows loading/empty/error, renders tenant buttons. Tenant click calls `onChange(tenant.id, tenant)` and closes. Building change calls `onChange("", null)` and clears list before fetching.
- [ ] **Step 3:** Run `pnpm typecheck`; expect PASS.
- [ ] **Step 4:** Commit `feat: add building tenant picker control`.

### Task 4: Wire lease form + page

**Files:** Modify `src/app/[locale]/(app)/leases/new/page.tsx`, `src/components/domain/lease-form.tsx`

**Interfaces:** `LeaseForm` drops `tenants` prop, gains `buildings: BuildingOption[]` and `initialTenant?: (PickerTenant & { buildingId: string }) | null`; `defaultTenantId` removed.

- [ ] **Step 1:** Page: add buildings query `select("id, code, name").order("code")`; remove all-tenants query; when `tenantId` search param present, resolve that one tenant (`tenant_directory` select `id, full_name, phone`) and its building via an active lease (unit or room → units.building_id) into `initialTenant`.
- [ ] **Step 2:** Form: replace tenant `Select` with picker; `onChange={(id) => field.onChange(id)}`; pass labels from `useTranslations("tenantPicker")` added to the labels prop.
- [ ] **Step 3:** Run `pnpm typecheck`; expect PASS.
- [ ] **Step 4:** Commit `feat: use tenant picker in lease form`.

### Task 5: Wire payment form + page

**Files:** Modify `src/app/[locale]/(app)/payments/page.tsx`, `src/components/domain/payment-form.tsx`

**Interfaces:** `PaymentForm` drops `tenants` prop, gains `buildings: BuildingOption[]`.

- [ ] **Step 1:** Page: add buildings query; remove all-tenants query; pass `buildings`.
- [ ] **Step 2:** Form: replace tenant `Select` with picker; `onChange` reuses existing `handleTenantChange` (clears `leaseId`, allocations, loads charges) — adapt it to the new `(tenantId, tenant)` signature.
- [ ] **Step 3:** Run `pnpm typecheck`; expect PASS.
- [ ] **Step 4:** Commit `feat: use tenant picker in payment form`.

### Task 6: Wire cheque table + page

**Files:** Modify `src/app/[locale]/(app)/cheques/page.tsx`, `src/components/domain/cheque-table.tsx`

**Interfaces:** `ChequeTable` drops `tenants` prop, gains `buildings: BuildingOption[]`.

- [ ] **Step 1:** Page: add buildings query; remove all-tenants query; pass `buildings`.
- [ ] **Step 2:** Table: replace register-modal tenant `Select` with picker; `onChange` sets `tenantId` and clears `leaseId` as before.
- [ ] **Step 3:** Run `pnpm typecheck`; expect PASS.
- [ ] **Step 4:** Commit `feat: use tenant picker in cheque form`.

### Task 7: Full verification

- [ ] **Step 1:** Run `pnpm lint && pnpm typecheck && pnpm test`; expect all PASS.
- [ ] **Step 2:** Commit any fixes.
