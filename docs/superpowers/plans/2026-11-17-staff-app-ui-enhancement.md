# Staff app UI enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every staff app screen a shared header with description and related-section links, and convert its forms to shadcn/react-hook-form with inline, translated validation.

**Architecture:** Three shared pieces — `PageHeader` + `related-links` for navigation, `toFormData` + `LocalizedFormMessage` for the form bridge, and Zod schemas moved out of `"use server"` files into `src/schemas/` — are built once, then adopted screen-by-screen. Server actions keep `safeParse`, RBAC and RLS as the final authority; client validation only gives immediate inline feedback.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 3, shadcn/ui, react-hook-form, zod + `@hookform/resolvers`, next-intl (en/ar), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-staff-app-ui-enhancement-design.md`

## Global Constraints

- All user-visible strings go through next-intl (`messages/en.json`, `messages/ar.json`); no hard-coded UI text.
- RTL uses logical Tailwind utilities only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`); never `left`/`right`/`ml-`/`mr-`/`pl-`/`pr-`.
- Branding colors and fonts come from CSS variables; do not hard-code brand colors in components.
- No new dependencies. `react-hook-form`, `@hookform/resolvers`, `zod` and all shadcn primitives are already installed.
- A `"use server"` module may only export async functions: shared schemas live in `src/schemas/` and are imported by both server actions and client forms.
- Server actions keep their existing signature `(prevState, formData) => Promise<State>` and still call `safeParse`; do not weaken RBAC/RLS or financial logic.
- Server Components by default; add `"use client"` only to converted form components.
- Tests ship with the code: Vitest for pure logic (`src/**/*.test.ts`), Playwright for en/ar UI flows.
- Definition of done per task: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; `supabase test db` if the local stack is available.
- Do not refactor unrelated code or touch route groups outside `(app)` except token-only primitive changes.

## Review Focus

- **Arabic RTL and unseen locale:** the related-links strip and inline form errors must read correctly in `ar` — e2e test in Task 2 and final RTL check in Task 9.
- **Missing translation for a Zod error key:** a schema key absent from `ar.json` must not crash the form — `t.has()` fallback plus key-parity check in Task 1 and Task 9.
- **`FormData` conversion of `false`, numbers and files:** `isSublet: false` must be submitted as `"false"`, numbers stringified, `File` preserved — unit test in Task 1.
- **Capability-filtered cross-links:** a viewer must not see links to sections their role cannot access — unit test for `relatedHrefs` in Task 2.
- **Shared primitive changes leak outside the pilot:** `form.tsx`/input styling changes must not break owner/portal/platform screens — route-render e2e in Task 9.

---

### Task 1: Form bridge, localized errors and shadcn token fixes

**Files:**
- Create: `src/lib/form-data.ts`, `src/lib/form-data.test.ts`
- Create: `src/components/domain/localized-form-message.tsx`
- Modify: `src/components/ui/form.tsx`, and `src/components/ui/{input,textarea,select,checkbox,radio-group}.tsx` where inconsistent
- Modify: `messages/en.json`, `messages/ar.json` (add `validation.*` keys to both)

**Interfaces:**
- Produces: `toFormData(values: Record<string, unknown>): FormData` — flat values only; `null`/`undefined` skipped, `File` kept, everything else `String(value)`.
- Produces: `LocalizedFormMessage` — same props as shadcn `FormMessage`; no required props. Reads the field error with `useFormField()` and renders `t.has(key) ? t(key) : key` when the message is an i18n key, otherwise the raw message.
- Produces: `validation.*` keys: `required`, `invalidEmail`, `invalidDate`, `invalidAmount`, `invalidSlug`, `tooShort`, `tooLong`, `invalidUuid`, `invalidRange`, `invalidInput` — in both locale files with the same key set.

- [ ] **Step 1: Write the failing `toFormData` test**

In `src/lib/form-data.test.ts`, assert: `{ isSublet: false, rent: 10000, deposit: null, name: undefined }` → `fd.get("isSublet") === "false"`, `fd.get("rent") === "10000"`, `fd.has("deposit") === false`, `fd.has("name") === false`; and a `new File(["x"], "a.txt")` under key `proof` is returned as that same `File` instance.

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run src/lib/form-data.test.ts`
Expected: FAIL — cannot resolve `./form-data`.

- [ ] **Step 3: Implement `toFormData`**

Create `src/lib/form-data.ts` with the signature above. Skip `null`/`undefined`, preserve `File`, stringify all other values. Comment only if a branch is non-obvious.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run src/lib/form-data.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Fix shadcn form token classes**

In `src/components/ui/form.tsx`, replace `text-oklch(0.556 0 0) dark:text-oklch(0.708 0 0)` with `text-on-surface-variant`, and `text-oklch(0.577 0.245 27.325) dark:text-oklch(0.704 0.191 22.216)` with `text-error`. Keep `font-body-sm` on both `FormDescription` and `FormMessage` and keep the existing `aria-invalid`/`aria-describedby` wiring untouched.

- [ ] **Step 6: Align shared input primitives**

In `src/components/ui/{input,textarea,select,checkbox,radio-group}.tsx`, fix only focus/hover/error states that disagree with the design brief: gold focus ring (`focus:ring-primary-fixed` / `focus-visible:ring-primary-fixed`), error state via `aria-invalid`, and 42–44px control height. Keep every existing class that already matches; these files are shared with owner/portal/platform, so do not change layout or color language.

- [ ] **Step 7: Add `LocalizedFormMessage`**

Create `src/components/domain/localized-form-message.tsx` as a `"use client"` component. Use `useFormField()` from `@/components/ui/form` to read `error`, and `useTranslations()` (no namespace) with `t.has()` to translate `error.message` when it is one of the `validation.*` keys; otherwise render the raw message. Return `null` when there is no error, matching shadcn `FormMessage`.

- [ ] **Step 8: Add validation keys to both locales**

Add the same ten `validation.*` keys to `messages/en.json` and `messages/ar.json` under a new top-level `validation` object, with natural English and Arabic text. Do not change any existing key.

- [ ] **Step 9: Verify types and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/lib/form-data.ts src/lib/form-data.test.ts src/components/domain/localized-form-message.tsx src/components/ui messages/en.json messages/ar.json
git commit -m "feat(ui): form bridge, localized inline errors and token fixes"
```

---

### Task 2: PageHeader, related links and first two screens

**Files:**
- Create: `src/components/domain/page-header.tsx`, `src/components/domain/related-links.ts`, `src/components/domain/related-links.test.ts`
- Create: `e2e/ui-polish.spec.ts`
- Modify: `src/app/[locale]/(app)/dashboard/page.tsx`, `src/app/[locale]/(app)/buildings/page.tsx`
- Modify: `messages/en.json`, `messages/ar.json` (`common.relatedSections`)

**Interfaces:**
- Consumes: none beyond `NAV_ITEMS`/`FOOTER_NAV` from `src/components/domain/nav-items.ts`, `visibleNav` and `Role`.
- Produces: `type RelatedSection = "dashboard" | "buildings" | "tenants" | "leases" | "payments" | "cheques" | "deposits" | "expenses" | "maintenance" | "inspections" | "meters" | "reports" | "documents" | "settings"`.
- Produces: `RELATED_SECTIONS: Record<RelatedSection, readonly string[]>` with exactly these href lists: `dashboard: ["/buildings", "/leases", "/reports"]`; `buildings: ["/tenants", "/leases", "/documents", "/reports"]`; `tenants: ["/buildings", "/leases", "/payments"]`; `leases: ["/tenants", "/buildings", "/payments", "/cheques", "/reports"]`; `payments: ["/leases", "/cheques", "/reports"]`; `cheques: ["/leases", "/payments", "/reports"]`; `deposits: ["/leases", "/payments", "/reports"]`; `expenses: ["/buildings", "/payments", "/reports"]`; `maintenance: ["/buildings", "/meters", "/inspections"]`; `inspections: ["/buildings", "/maintenance"]`; `meters: ["/buildings", "/maintenance"]`; `reports: ["/payments", "/leases", "/expenses"]`; `documents: ["/buildings", "/tenants", "/leases"]`; `settings: ["/dashboard", "/documents"]`.
- Produces: `relatedHrefs(section: RelatedSection, role: Role): string[]` — `RELATED_SECTIONS[section]` filtered through `visibleNav(role, [...NAV_ITEMS, ...FOOTER_NAV])` so unauthorized links are dropped.
- Produces: `PageHeader({ section, role, title, description, actions? }: { section: RelatedSection; role: Role; title: string; description: string; actions?: React.ReactNode })` — async Server Component; resolves link labels via `getTranslations("nav")` and the strip heading via `getTranslations("common")`.

- [ ] **Step 1: Write the failing related-links test**

In `src/components/domain/related-links.test.ts`, assert `relatedHrefs("leases", "manager")` contains `/tenants` and `/payments`, and that the `caretaker` role (which lacks `finance.read`) does not receive `/payments`.

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run src/components/domain/related-links.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement related-links**

Create `src/components/domain/related-links.ts` with the exact types and function above. Resolve labels from the matching `NAV_ITEMS`/`FOOTER_NAV` entry's `labelKey`; include only hrefs present in the role-visible navigation.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run src/components/domain/related-links.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `PageHeader`**

Create `src/components/domain/page-header.tsx`. Render `h1` (`font-headline-lg text-headline-lg text-on-surface`), the description (`font-body-md text-body-md text-on-surface-variant`), optional `actions`, then a strip: `common.relatedSections` label plus pill links from `relatedHrefs(section, role)` using `Link` from `@/i18n/navigation`, an `ArrowUpRight` icon and logical spacing. Keep focus-visible rings; no `left`/`right` utilities.

- [ ] **Step 6: Add the strip heading to both locales**

Add `common.relatedSections` = "Related sections" / the natural Arabic equivalent to `messages/en.json` and `messages/ar.json`.

- [ ] **Step 7: Adopt the header on two screens**

Replace the `h1`/`p` blocks in `dashboard/page.tsx` (keep `t("empty")` as description for now) and `buildings/page.tsx` (`t("title")`, `t("subtitle")`) with `PageHeader`, passing `section="dashboard"`/`"buildings"`, `role={ctx.role}` and the existing action buttons as `actions`. Keep all data fetching, filters and pagination intact.

- [ ] **Step 8: Write the e2e test**

In `e2e/ui-polish.spec.ts`, add a test using the existing `signIn` helper pattern: visit `/{locale}/buildings`, assert the `h1` is visible, the description from `buildings.subtitle` is visible, the related-sections strip is visible, and clicking the Tenants link lands on `/{locale}/tenants`. It runs under both existing `en` and `ar` Playwright projects.

- [ ] **Step 9: Verify e2e and static checks**

Run: `pnpm test:e2e --grep "related sections"` (needs `pnpm dev` and the local Supabase stack)
Expected: PASS in `en` and `ar`.
Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/domain/page-header.tsx src/components/domain/related-links.ts src/components/domain/related-links.test.ts e2e/ui-polish.spec.ts src/app/\[locale\]/\(app\)/dashboard/page.tsx src/app/\[locale\]/\(app\)/buildings/page.tsx messages/en.json messages/ar.json
git commit -m "feat(ui): shared page header with role-filtered related sections"
```

---

### Task 3: Lease schema and form — establish the conversion pattern

**Files:**
- Create: `src/schemas/leases.ts`, `src/schemas/leases.test.ts`
- Modify: `src/server/actions/leases.ts`, `src/components/domain/lease-form.tsx`, `src/app/[locale]/(app)/leases/new/page.tsx`
- Modify: `e2e/ui-polish.spec.ts`

**Interfaces:**
- Consumes: `toFormData`, `LocalizedFormMessage`, `validation.*` keys from Task 1.
- Produces: `createLeaseSchema` exported from `src/schemas/leases.ts` — same field rules as the current local schema, with i18n-key `message` values on the fields shown inline (`rent`, `startDate`, `endDate`, `tenantId`, `installments`, `dueDay`).
- Produces: the canonical form conversion pattern used by Tasks 4–7: `useForm({ resolver: zodResolver(schema), defaultValues })` + `useActionState(action, {})` + `form.handleSubmit(values => dispatch(toFormData(values)))`; fields wrapped `FormField → FormItem → FormLabel → FormControl → FormDescription → LocalizedFormMessage`; native selects/radio/checkbox replaced with shadcn `Select`/`RadioGroup`/`Checkbox`.

- [ ] **Step 1: Write failing schema tests**

In `src/schemas/leases.test.ts`, assert: a valid lease object passes; `rent: ""` fails with message `validation.required`; `startDate: "17/11/2026"` fails with `validation.invalidDate`; `endDate: ""` fails with `validation.required`; `isSublet: true` without `parentLeaseId` leaves `parentLeaseId` optional (today's rule) — assert the valid sublet case with a UUID parent passes. Do not add a cross-field date-order rule in this phase.

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm vitest run src/schemas/leases.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Extract and import the shared schema**

Create `src/schemas/leases.ts` exporting `createLeaseSchema` with today's exact rules plus the i18n-key messages. Delete the local `const createLeaseSchema` from `src/server/actions/leases.ts` and import the shared one. The action body and return type stay unchanged.

- [ ] **Step 4: Run schema tests and confirm they pass**

Run: `pnpm vitest run src/schemas/leases.test.ts`
Expected: PASS.

- [ ] **Step 5: Convert `lease-form.tsx`**

Apply the canonical pattern above to `src/components/domain/lease-form.tsx`, preserving the live charge preview (`useMemo`/`planLeaseCharges`), the sublet conditional block, and the redirect on success. Replace raw `select`/`input type=radio`/checkbox with shadcn primitives. Add short `FormDescription` hints for lease number, rent, due day, deposit and notice days. Keep the existing top `role="alert"` banner for server errors.

- [ ] **Step 6: Move its hard-coded English into next-intl**

Move `"Room"`, `"Auto-generated if empty"`, the preview table headers (`Type`, `Period`, `Due Date`, `Amount`) and the sublet explanation into `messages/en.json` + `messages/ar.json`; pass them through the existing `labels` prop from `leases/new/page.tsx`. No visible string remains literal in the component.

- [ ] **Step 7: Add the inline-error e2e test**

In `e2e/ui-polish.spec.ts`, add: visit `/{locale}/leases/new`, clear `rent`, submit, assert the localized `validation.required` message is visible next to the rent field and the form did not navigate. Runs in both `en` and `ar`.

- [ ] **Step 8: Verify**

Run: `pnpm vitest run src/schemas/leases.test.ts && pnpm typecheck && pnpm lint && pnpm build`
Expected: all pass.
Run: `pnpm test:e2e --grep "lease form"` (needs running app and local Supabase)
Expected: PASS in `en` and `ar`.

- [ ] **Step 9: Commit**

```bash
git add src/schemas/leases.ts src/schemas/leases.test.ts src/server/actions/leases.ts src/components/domain/lease-form.tsx src/app/\[locale\]/\(app\)/leases/new/page.tsx e2e/ui-polish.spec.ts messages/en.json messages/ar.json
git commit -m "feat(leases): shared schema and inline validated form"
```

---

### Task 4: Property and tenant schemas and forms

**Files:**
- Create: `src/schemas/property.ts`, `src/schemas/property.test.ts`, `src/schemas/tenants.ts`, `src/schemas/tenants.test.ts`
- Modify: `src/server/actions/property.ts`, `src/server/actions/tenants.ts`
- Modify: `src/components/domain/building-form.tsx`, `src/components/domain/tenant-form.tsx`, `src/components/domain/bulk-forms.tsx`, `src/components/domain/building-access.tsx`, `src/components/domain/import-form.tsx`

**Interfaces:**
- Consumes: canonical form pattern from Task 3 and `validation.*` keys from Task 1.
- Produces: `buildingSchema`, `floorsSchema`, `unitsSchema` from `src/schemas/property.ts`; `tenantSchema` from `src/schemas/tenants.ts` — same names and rules as the current local consts, with i18n-key messages.

- [ ] **Step 1: Write failing schema tests**

In `property.test.ts` assert a valid building and a valid units array pass, an empty building `code` fails with `validation.required`, and a non-numeric floor count fails. In `tenants.test.ts` assert a valid tenant passes, `fullName: ""` fails with `validation.required`, `email: "not-an-email"` fails with `validation.invalidEmail`, and a 31-character `idNumber` fails with `validation.tooLong`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm vitest run src/schemas/property.test.ts src/schemas/tenants.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Extract and import the schemas**

Move the four consts from the two `"use server"` files into the new `src/schemas/*.ts` files, export them, and import them back into the actions. Do not change action bodies.

- [ ] **Step 4: Run schema tests and confirm they pass**

Run: `pnpm vitest run src/schemas/property.test.ts src/schemas/tenants.test.ts`
Expected: PASS.

- [ ] **Step 5: Convert the five forms**

Apply the Task 3 pattern to `building-form.tsx`, `tenant-form.tsx`, `bulk-forms.tsx`, `building-access.tsx` and `import-form.tsx`. Preserve CSV import parsing and bulk unit/floor generation logic unchanged; only the input binding, labels, hints and error rendering change. Move any hard-coded visible strings into both locale files.

- [ ] **Step 6: Verify**

Run: `pnpm vitest run src/schemas && pnpm typecheck && pnpm lint && pnpm build`
Expected: all pass.
Run: `pnpm test:e2e --grep "every workspace route renders"`
Expected: PASS in `en` and `ar`.

- [ ] **Step 7: Commit**

```bash
git add src/schemas/property.ts src/schemas/property.test.ts src/schemas/tenants.ts src/schemas/tenants.test.ts src/server/actions/property.ts src/server/actions/tenants.ts src/components/domain/building-form.tsx src/components/domain/tenant-form.tsx src/components/domain/bulk-forms.tsx src/components/domain/building-access.tsx src/components/domain/import-form.tsx messages/en.json messages/ar.json
git commit -m "feat(properties): shared schemas and inline validated forms"
```

---

### Task 5: Finance schemas and forms

**Files:**
- Create: `src/schemas/payments.ts`, `src/schemas/payments.test.ts`, `src/schemas/cheques.ts`, `src/schemas/cheques.test.ts`, `src/schemas/deposits.ts`, `src/schemas/deposits.test.ts`, `src/schemas/expenses.ts`, `src/schemas/expenses.test.ts`
- Modify: `src/server/actions/{payments,cheques,deposits,expenses}.ts`
- Modify: `src/components/domain/{payment-form,cheque-table,deposit-card,expense-form}.tsx`

**Interfaces:**
- Consumes: canonical form pattern from Task 3, `validation.required` and `validation.invalidDate` from Task 1.
- Produces: `recordPaymentSchema`, `registerChequeSchema`, `replaceChequeSchema`, `deductionSchema`, `refundSchema`, `createExpenseSchema` — same names and rules as current local consts, i18n-key messages.

- [ ] **Step 1: Write failing schema tests**

For each schema, assert one valid object passes and `amount: ""` fails with `validation.required`. For `registerChequeSchema`, also assert `chequeDate: "17/11/2026"` fails with `validation.invalidDate`. Keep today's amount rule (`z.string().min(1)`) unchanged — do not add a positivity rule in this phase.

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm vitest run src/schemas/payments.test.ts src/schemas/cheques.test.ts src/schemas/deposits.test.ts src/schemas/expenses.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Extract and import the schemas**

Move the six consts into the four new schema files, export them, import them back into the actions. Leave allocation, ledger and cheque status logic untouched.

- [ ] **Step 4: Run schema tests and confirm they pass**

Run: `pnpm vitest run src/schemas/payments.test.ts src/schemas/cheques.test.ts src/schemas/deposits.test.ts src/schemas/expenses.test.ts`
Expected: PASS.

- [ ] **Step 5: Convert the four forms**

Apply the Task 3 pattern to `payment-form.tsx`, the form inside `cheque-table.tsx`, both forms inside `deposit-card.tsx`, and `expense-form.tsx`. Keep money as `toMinor`-compatible decimal strings in RHF state; do not introduce floating-point money. Add hints for cheque date (post-dated), allocation amounts and deposit deduction/refund.

- [ ] **Step 6: Verify**

Run: `pnpm vitest run src/schemas && pnpm typecheck && pnpm lint && pnpm build`
Expected: all pass.
Run: `pnpm test:e2e --grep "every workspace route renders"`
Expected: PASS in `en` and `ar`.

- [ ] **Step 7: Commit**

```bash
git add src/schemas/payments.ts src/schemas/payments.test.ts src/schemas/cheques.ts src/schemas/cheques.test.ts src/schemas/deposits.ts src/schemas/deposits.test.ts src/schemas/expenses.ts src/schemas/expenses.test.ts src/server/actions/payments.ts src/server/actions/cheques.ts src/server/actions/deposits.ts src/server/actions/expenses.ts src/components/domain/payment-form.tsx src/components/domain/cheque-table.tsx src/components/domain/deposit-card.tsx src/components/domain/expense-form.tsx messages/en.json messages/ar.json
git commit -m "feat(finance): shared schemas and inline validated forms"
```

---

### Task 6: Operations schemas and forms

**Files:**
- Create: `src/schemas/maintenance.ts`, `src/schemas/maintenance.test.ts`, `src/schemas/inspections.ts`, `src/schemas/inspections.test.ts`, `src/schemas/meters.ts`, `src/schemas/meters.test.ts`, `src/schemas/documents.ts`, `src/schemas/documents.test.ts`
- Modify: `src/server/actions/{maintenance,inspections,meters,documents}.ts`
- Modify: `src/components/domain/{maintenance-form,inspection-form,meter-form,document-upload-form}.tsx`

**Interfaces:**
- Consumes: canonical form pattern from Task 3.
- Produces: `createRequestSchema`, `updateStatusSchema`, `createInspectionSchema`, `completeInspectionSchema`, `meterSchema`, `readingSchema`, `uploadSchema` — same names and rules as current local consts, i18n-key messages.

- [ ] **Step 1: Write failing schema tests**

For each create/upload schema assert one valid object passes and one missing required field fails with `validation.required`. For `readingSchema`, assert `value: ""` fails with `validation.required` and `readOn: "17/11/2026"` fails with `validation.invalidDate`. Keep the existing `value` rule unchanged.

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm vitest run src/schemas/maintenance.test.ts src/schemas/inspections.test.ts src/schemas/meters.test.ts src/schemas/documents.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Extract and import the schemas**

Move the seven consts into the four new schema files, export them, import them back into the actions. Leave checklist JSON parsing and file-storage logic unchanged.

- [ ] **Step 4: Run schema tests and confirm they pass**

Run: `pnpm vitest run src/schemas/maintenance.test.ts src/schemas/inspections.test.ts src/schemas/meters.test.ts src/schemas/documents.test.ts`
Expected: PASS.

- [ ] **Step 5: Convert the four forms**

Apply the Task 3 pattern to `maintenance-form.tsx`, `inspection-form.tsx`, both forms in `meter-form.tsx`, and `document-upload-form.tsx`. Keep file inputs working with `File` through `toFormData`. Add hints for priority, inspection checklist and meter reading date.

- [ ] **Step 6: Verify**

Run: `pnpm vitest run src/schemas && pnpm typecheck && pnpm lint && pnpm build`
Expected: all pass.
Run: `pnpm test:e2e --grep "every workspace route renders"`
Expected: PASS in `en` and `ar`.

- [ ] **Step 7: Commit**

```bash
git add src/schemas/maintenance.ts src/schemas/maintenance.test.ts src/schemas/inspections.ts src/schemas/inspections.test.ts src/schemas/meters.ts src/schemas/meters.test.ts src/schemas/documents.ts src/schemas/documents.test.ts src/server/actions/maintenance.ts src/server/actions/inspections.ts src/server/actions/meters.ts src/server/actions/documents.ts src/components/domain/maintenance-form.tsx src/components/domain/inspection-form.tsx src/components/domain/meter-form.tsx src/components/domain/document-upload-form.tsx messages/en.json messages/ar.json
git commit -m "feat(operations): shared schemas and inline validated forms"
```

---

### Task 7: Settings schemas and forms

**Files:**
- Create: `src/schemas/settings.ts`, `src/schemas/settings.test.ts`, `src/schemas/members.ts`, `src/schemas/members.test.ts`
- Modify: `src/server/actions/{settings,members}.ts`
- Modify: `src/components/domain/{branding-form,org-form,organization-settings-form,notification-template-form,invite-form}.tsx`

**Interfaces:**
- Consumes: canonical form pattern from Task 3; keep `src/schemas/auth.ts` as the existing example.
- Produces: `organizationSchema`, `brandingSchema`, `templateSchema` from `src/schemas/settings.ts`; `inviteSchema` from `src/schemas/members.ts`. `pushSubscriptionSchema` stays local to the action (it consumes JSON, not a rendered form).

- [ ] **Step 1: Write failing schema tests**

Assert a valid organization/branding/template/invite object passes and a bad email in `inviteSchema` fails with `validation.invalidEmail`; a too-long organization name fails with `validation.tooLong`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm vitest run src/schemas/settings.test.ts src/schemas/members.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Extract and import the schemas**

Move the four consts into the two new schema files, export them, import them back into the actions. Leave `pushSubscriptionSchema` in `settings.ts` and leave JSON parsing, branding CSS variable writes and notification template logic untouched.

- [ ] **Step 4: Run schema tests and confirm they pass**

Run: `pnpm vitest run src/schemas/settings.test.ts src/schemas/members.test.ts`
Expected: PASS.

- [ ] **Step 5: Convert the five forms**

Apply the Task 3 pattern to `branding-form.tsx`, `org-form.tsx`, `organization-settings-form.tsx`, `notification-template-form.tsx` and `invite-form.tsx`. Preserve branding preview and template variable insertion. Add hints for workspace slug, currency and invite role.

- [ ] **Step 6: Verify**

Run: `pnpm vitest run src/schemas && pnpm typecheck && pnpm lint && pnpm build`
Expected: all pass.
Run: `pnpm test:e2e --grep "every workspace route renders"`
Expected: PASS in `en` and `ar`.

- [ ] **Step 7: Commit**

```bash
git add src/schemas/settings.ts src/schemas/settings.test.ts src/schemas/members.ts src/schemas/members.test.ts src/server/actions/settings.ts src/server/actions/members.ts src/components/domain/branding-form.tsx src/components/domain/org-form.tsx src/components/domain/organization-settings-form.tsx src/components/domain/notification-template-form.tsx src/components/domain/invite-form.tsx messages/en.json messages/ar.json
git commit -m "feat(settings): shared schemas and inline validated forms"
```

---

### Task 8: Adopt PageHeader everywhere and finish copy cleanup

**Files:**
- Modify list screens: `tenants`, `leases`, `payments`, `cheques`, `deposits`, `expenses`, `maintenance`, `inspections`, `meters`, `reports`, `documents` (`src/app/[locale]/(app)/<route>/page.tsx`)
- Modify detail screens: `buildings/[id]`, `tenants/[id]`, `leases/[id]`, `units/[id]`, `buildings/import`
- Modify settings screens: `settings`, `settings/accounting`, `settings/audit`, `settings/branding`, `settings/export`, `settings/notifications`, `settings/organization`, `settings/users`
- Modify `src/components/domain/app-shell.tsx`
- Modify `messages/en.json`, `messages/ar.json`

**Interfaces:**
- Consumes: `PageHeader` from Task 2 with `RelatedSection` values matching each screen's nav section.

- [ ] **Step 1: Replace remaining header blocks**

In each listed page, replace the ad-hoc `h1` + description block with `PageHeader` using the screen's translation namespace `t("title")` / `t("subtitle")` (dashboard keeps `t("empty")`), `role={ctx.role}` and the section key matching its nav item. Detail pages keep their `← back` link and use their list section key. Settings subpages use `section="settings"`. Keep every filter, action, chart and table unchanged.

- [ ] **Step 2: Add contextual inline links**

In list/detail screens, make named entities link to their detail page where a link is not already present: tenant name → `/tenants/[id]`, building code/name → `/buildings/[id]`, lease number → `/leases/[id]`. Use the existing `Link` from `@/i18n/navigation` and keep RBAC-driven visibility as-is.

- [ ] **Step 3: Finish hard-coded copy cleanup**

Move the remaining literal English from `dashboard/page.tsx` (`Occupancy`, `Monthly Rent Roll`, `Net Operating Income`, `Active Work Orders`, `Active lease pipeline`, `YTD collections less expenses`, `View queue`, `No buildings created.`, `Ends`, `Due`) into both locale files and render via `t(...)`. Check other changed screens for literals with the grep in Step 5.

- [ ] **Step 4: Fix the bell label**

In `src/components/domain/app-shell.tsx`, change the notification bell's `aria-label` from `t("dashboard.title")` to a new `common.notifications` key added to both locales. No other shell changes.

- [ ] **Step 5: Audit changed files**

Run: `grep -rInE 'text-label-lg|font-title|>[A-Z][a-z]+ [A-Za-z]+ <' src/app/\[locale\]/\(app\) src/components/domain/{lease-form,app-shell}.tsx`
Expected: no literal user-facing English in the changed JSX and no undefined type classes introduced.

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`
Expected: all pass.
Run: `pnpm test:e2e`
Expected: PASS in `en` and `ar`.

- [ ] **Step 7: Commit**

```bash
git add src/app/\[locale\]/\(app\) src/components/domain/app-shell.tsx messages/en.json messages/ar.json
git commit -m "feat(ui): consistent headers, cross-links and translated copy across staff app"
```

---

### Task 9: Final verification and handoff

**Files:**
- Modify: `docs/DECISIONS.md` only if a deviation was introduced; otherwise no code changes.

**Interfaces:**
- Consumes: everything from Tasks 1–8.

- [ ] **Step 1: Run the full gate**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all pass.

- [ ] **Step 2: Run database tests if available**

Run: `supabase test db`
Expected: PASS. If the local stack is unavailable, record that in the handoff and do not claim it passed.

- [ ] **Step 3: Run both-locale e2e**

Run: `pnpm test:e2e`
Expected: PASS for `en` and `ar`, including the new related-sections and lease inline-error tests.

- [ ] **Step 4: Verify RTL and shared-primitives regressions**

In the running app, view `en` and `ar` versions of `/buildings`, `/leases/new` and `/settings`; confirm the strips and form hints align correctly and focus rings are visible. Visit `/owner`, `/portal` and `/platform` and confirm no layout regression from the shared primitive changes.

- [ ] **Step 5: Verify locale key parity and no new dependencies**

Run: `node -e 'const en=require("./messages/en.json"),ar=require("./messages/ar.json");const keys=o=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==="object"?keys(v).map(x=>k+"."+x):[k]);const a=new Set(keys(en)),b=new Set(keys(ar));console.log([...a].filter(k=>!b.has(k)),[...b].filter(k=>!a.has(k)))'`
Expected: two empty arrays.
Run: `git diff -- package.json`
Expected: no dependency changes.

- [ ] **Step 6: Commit any deviation record and finish**

If `docs/DECISIONS.md` changed, commit it with `docs(ui): record UI rollout deviations`. Otherwise no commit. Report the exact commands run and their results.
