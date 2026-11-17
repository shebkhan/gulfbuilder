# Staff app UI enhancement — shared foundation and pilot (sub-project 1 of N)

## Problem

The app has ~60 screens across five route groups and ~20 form components. The current state has
three concrete problems:

1. Page headers are hand-written in each screen. Some have a title and subtitle, others do not;
   the dashboard uses `t("empty")` as its description and several labels are hard-coded English,
   which breaks `docs/CLAUDE.md` ("all user-visible strings go through next-intl").
2. Forms use `useActionState` + raw `FormData`, with Zod validation only inside `"use server"` action
   files and a single error banner at the bottom. The installed shadcn `Form` primitives,
   `react-hook-form` and `zodResolver` are unused. Two classes in `src/components/ui/form.tsx`
   (`text-oklch(...)`) are not valid Tailwind and silently render no color.
3. Related sections are linked inconsistently — mostly only on the dashboard — so users cannot
   move between a lease, its tenant, its unit and its payments/reports without going back to the
   sidebar.

Changing all 60 screens in one plan is too large and would produce inconsistent details. This
spec covers the shared foundation plus the staff app `(app)` route group as the pilot. Owner
portal, tenant portal, platform console and auth screens are separate later sub-projects.

## Goal

Introduce one shared page header with a helpful description and related-section links, one shared
validated-form pattern with inline field errors, and consistent polish within the existing
"Gulf Estate Intelligence" design system — then apply them to every staff app screen and form.

## Decisions

- **Scope:** foundation + all screens/forms in `src/app/[locale]/(app)/` as the pilot. Other route
  groups are out of scope for this spec.
- **Visual direction:** polish within the existing design system
  (`docs/design_brief/gulf_estate_intelligence/DESIGN.md`). No new palette, fonts, spacing scale
  or layout framework. White-label CSS variables stay authoritative.
- **Forms:** full conversion to `react-hook-form` + `zodResolver` with shared Zod schemas and shadcn
  `Form*` primitives. Server actions remain the final submit path and keep all RBAC/RLS and
  business validation.
- **Cross-links:** a compact "Related sections" strip in the shared header **plus** natural inline
  links in tables/cards. No breadcrumbs — the sidebar already shows location and detail pages link
  back to their list.
- **Implementation strategy:** build shared primitives once, then adopt them screen by screen.
  No per-screen copies of header or validation logic.
- No new dependencies, no backend/RLS/financial-logic changes.

## Design

### 1. Shared components (no visual change until adopted)

- `src/components/domain/page-header.tsx` — Server Component. Props: `section: RelatedSection`,
  `role: Role`, `title: string`, `description: string`, `actions?: React.ReactNode`. Renders an
  `h1` (`font-headline-lg`), a description paragraph (`font-body-md text-on-surface-variant`)
  and the related-sections strip. Use logical utilities only (`ms-`, `me-`, `text-start`) so RTL
  works. No hard-coded brand colors.
- `src/components/domain/related-links.ts` — one `RELATED_SECTIONS: Record<RelatedSection, string[]>`
  map of related hrefs, built from existing `NAV_ITEMS` entries and filtered with
  `visibleNav(role, …)`. Link labels come from existing `nav.*` keys; the only new label is the
  strip heading `common.relatedSections`. No second navigation graph. Example: `leases` →
  `/tenants`, `/buildings`, `/payments`, `/cheques`, `/reports`.
- `src/lib/form-data.ts` — `toFormData(values: Record<string, unknown>): FormData`, converting flat
  RHF values (including `File`) to the `FormData` the existing server actions already consume.
  Keeps action signatures unchanged.
- `src/components/domain/localized-form-message.tsx` — wraps shadcn `FormMessage`, reads the field
  error via `useFormField()`, and translates stable error keys with `useTranslations()` +
  `t.has()` fallback to the raw message. This is the only place that knows how to localize Zod
  messages.

### 2. shadcn primitive fixes

- `src/components/ui/form.tsx`: replace `text-oklch(0.556 0 0)` / `text-oklch(0.708 0 0)` with
  `text-on-surface-variant`, and `text-oklch(0.577 0.245 27.325)` / `text-oklch(0.704 0.191 22.216)`
  with `text-error`. Use `font-body-sm text-[0.8rem]` consistently for `FormDescription` and
  `FormMessage`. Keep the existing `aria-invalid` / `aria-describedby` wiring and focus rings.
- `src/components/ui/{input,textarea,select,checkbox,radio-group}.tsx`: only where inconsistent with
  the design brief, align focus/hover/error states to the gold focus ring and 42–44px control
  height. Do not introduce new visual language. These primitives are shared by all route groups, so
  changes must be token-only and checked in owner/portal/platform screens too.

### 3. Shared schemas and validation flow

- A `"use server"` module may only export async functions. Move each local `z.object(...)` from
  `src/server/actions/leases.ts`, `tenants.ts`, `property.ts`, `payments.ts`, `cheques.ts`,
  `deposits.ts`, `expenses.ts`, `maintenance.ts`, `inspections.ts`, `meters.ts`, `documents.ts`,
  `settings.ts` and `members.ts` into `src/schemas/<domain>.ts`, export them, and import them from
  both the action and the client form. `src/server/actions/auth.ts` already imports its schemas from
  `src/schemas/auth.ts`, and platform console schemas are out of scope; follow the existing
  `src/schemas/auth.ts` naming and exports.
- Zod messages become stable i18n keys (the repo already uses `"invalid_slug"`), e.g.
  `validation.required`, `validation.invalidDate`, `validation.invalidAmount`. No English prose in
  schemas. `LocalizedFormMessage` renders them in the active locale.
- Each converted form follows this exact pattern; do not invent a wrapper abstraction:

  ```tsx
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const [state, dispatch, pending] = useActionState(action, {});
  const onSubmit = form.handleSubmit((values) => dispatch(toFormData(values)));

  <Form {...form}>
    <form onSubmit={onSubmit} noValidate>
      {/* FormField > FormItem > FormLabel > FormControl > FormDescription > LocalizedFormMessage */}
    </form>
  </Form>
  ```

- Native `<select>` becomes shadcn `Select`; native checkbox/radio become shadcn `Checkbox` /
  `RadioGroup` (all already installed). Each field gets a short, genuinely useful `FormDescription`
  hint, e.g. "Auto-generated if left blank", "KWD, BHD and OMR use 3 decimals", "1–28; instalments
  post on this day".
- The server still runs `safeParse`, RBAC and RLS checks and remains the source of truth. Server-only
  errors (duplicate lease number, permission failure) continue to appear in the existing top
  `role="alert"` banner. Per-field server errors are **not** added in this phase.

### 4. Screen rollout (all within `(app)`)

Order, in small commits:

1. Foundation components, schema extraction, i18n keys (no visual change).
2. Dashboard and list screens: `dashboard`, `buildings`, `tenants`, `leases`, `payments`,
   `cheques`, `deposits`, `expenses`, `maintenance`, `inspections`, `meters`, `reports`,
   `documents`. Replace ad-hoc `h1`/`p` blocks with `PageHeader`; add related links; add inline
   links where an entity is named (tenant → tenant detail, building → building detail, lease no. →
   lease detail). Keep existing filters, pagination and empty states.
3. Detail screens: `buildings/[id]`, `tenants/[id]`, `leases/[id]`, `buildings/import` — same header,
   back link to the list, and related links.
4. Settings screens: `settings` plus `accounting`, `audit`, `branding`, `export`, `notifications`,
   `organization`, `users` — same header and related links.
5. Convert forms alongside their screens: `lease-form`, `building-form`, `tenant-form`,
   `payment-form`, `deposit-card` actions, `expense-form`, `maintenance-form`, `inspection-form`,
   `meter-form`, `import-form`, `invite-form`, `branding-form`, `org-form`,
   `organization-settings-form`, `notification-template-form`, `document-upload-form`,
   `bulk-forms`, `building-access`.

### 5. Copy cleanup and shell polish

- Move hard-coded English found during exploration into `messages/en.json` and `messages/ar.json`:
  dashboard KPI labels and subtitles ("Occupancy", "Monthly Rent Roll", "Net Operating Income",
  "Active Work Orders", "Active lease pipeline", "YTD collections less expenses", "View queue",
  "No buildings created.", "Ends", "Due"); lease form ("Room", "Auto-generated if empty", preview
  table headers, sublet explanation).
- `src/components/domain/app-shell.tsx`: limit changes to token/focus polish and fix the bell
  button's `aria-label`, which currently reads `t("dashboard.title")` instead of a notifications
  label. `AppShell` is shared with owner/portal/platform, so check those route groups for
  regressions.

### 6. i18n

- Add to **both** `messages/en.json` and `messages/ar.json`: `common.relatedSections`, `validation.*`
  error keys, per-screen `description` where missing, and per-field `help.*` hints. Keep key parity
  between locales. Arabic strings must be natural Arabic, not machine transliterations.

## Out of scope

- Owner portal, tenant portal, platform console, auth, onboarding and print route groups.
- New colors, fonts, spacing scale or layout framework; changes to org branding CSS variables.
- Backend, RLS, RPC, financial or date logic changes; new dependencies.
- Per-field error messages returned by server actions.

## Tests and definition of done

- Vitest for the extracted shared schemas (valid/invalid cases, including localized message keys).
- Playwright in both `en` and `ar`: lease form shows inline errors and submits successfully;
  buildings list shows description + related links and navigates to a related section.
- Verify RTL screenshots for the header strip and a converted form; confirm focus rings and 44px
  targets remain.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass; `supabase test db` if the local
  stack is available.
- No visible string added outside next-intl; no `left`/`right`/`ml-`/`mr-`/`pl-`/`pr-` in changed
  JSX.

## Known limit

Server-only validation errors still surface as a top banner rather than under a field. This keeps
the diff small and server actions authoritative; per-field server errors need a separate change to
action state shape.
