# v1 completion design — portals, white-label, platform console

Date: 16 November 2026 · Spec: `docs/SPEC.md` · Conventions: `docs/CLAUDE.md`
Status: approved by owner 16 Nov 2026 (all remaining v1 surfaces; testing and automation skipped)

## 1. Goal

Finish the SPEC v1 feature set that M0–M5 left open, minus two categories the owner excluded:
**testing** (Vitest, pgTAP, Playwright, CI, load/restore runs) and **automation**
(pg_cron schedules, Edge Function senders, scheduled report delivery).

## 2. Scope

| Phase | Ships | Area |
|---|---|---|
| P1 | `platform_admins`, `plans`, `subscriptions`, `usage_snapshots`, branding domain columns, RLS tightening for tenant/owner self-scope, scope helper functions, private `documents` storage bucket | `supabase/migrations/20261116000022_*.sql` |
| P2 | Tenant portal: home, statement, payments (transfer-proof upload), requests, documents | `src/app/[locale]/(portal)/**` |
| P3 | Owner portal: dashboard, buildings, rent roll, aged receivables, statements, payouts, approvals, documents | `src/app/[locale]/(owner)/**` |
| P4 | `/documents` vault, `/meters` + readings, settings screens (organization, branding, accounting, notifications) | `(app)/documents`, `(app)/meters`, `(app)/settings/*` |
| P5 | Host→organization middleware, branding CSS variables, terminology overrides merged into next-intl messages, branding editor | `src/middleware.ts`, `src/app/[locale]/layout.tsx` |
| P6 | Super-admin console: organizations, plan + limits, usage, market packs, audited impersonation | `src/app/[locale]/(platform)/**` |
| P7 | Printable receipt, tenant statement, owner statement, lease contract (bilingual HTML, browser "Save as PDF") | `src/app/[locale]/print/**` |
| P8 | Admin guide, runbook, import CSV templates, DECISIONS entries | `docs/**` |

Explicitly out of scope: every test suite and CI job, all scheduled jobs and Edge Functions,
email/WhatsApp delivery, phase-2 items (forecast/scenarios, budgets, bank import and
reconciliation, multi-currency consolidation), native apps, registry integrations.

## 3. Decisions

### 3.1 PDFs are print-optimized HTML, not `@react-pdf/renderer`
SPEC §3 names `@react-pdf/renderer`. Rendering Arabic RTL in react-pdf requires registering an
embedded Arabic font binary; a print stylesheet renders Arabic and RTL correctly through the
browser's own text engine, adds no dependency, and keeps every label in next-intl. Each printable
document is a route under `/{locale}/print/...` with a `@media print` stylesheet and a
"Print / Save as PDF" button. Logged as a deviation.

### 3.2 Platform admins are not org members
`member_role` has no `platform_admin` value and must not grow one: a platform admin belongs to no
organization. A separate `platform_admins (user_id uuid primary key)` table holds them, and the
`(platform)` route group is the only place the service-role client is used (CLAUDE architecture
rules). Every platform action is written to `audit_log`.

### 3.3 RLS tightening is a prerequisite, not a follow-up
Today `payments`, `expenses`, `owner_statements`, `owner_ledger_entries` and the journals use
`org_id = auth_org()` alone, so any member of an organization — including a tenant — can read the
whole organization's money data. Portals make that exploitable, so P1 rewrites those policies:

- **tenant**: reads rows whose lease belongs to a tenant with `tenants.user_id = auth.uid()`;
  writes only their own maintenance requests and payment proofs (`pending_confirmation`).
- **owner**: reads rows tied to buildings they own (`owners.user_id = auth.uid()`), their own
  statements, payouts and expense approvals; updates only their own approval row.
- **staff**: unchanged.

Helper functions, all `security definer` and keyed on `auth.uid()` only:
`is_platform_admin()`, `tenant_lease_ids()`, `owner_building_ids()`, `org_feature_enabled(org, feature)`.

### 3.4 One private storage bucket
`documents`, private, path `{org_id}/{entity}/{id}/{filename}`. Bucket policies check the first
path segment against `auth_org()` plus entity-level access. Uploads go through server actions;
downloads are signed URLs generated server-side.

### 3.5 Notifications enqueue, nothing sends
`notification_outbox` rows are written on payment received, cheque bounced and lease expiring.
Templates are editable in settings. The Edge Function sender, pg_cron reminder jobs and
scheduled-report delivery are automation and are skipped; the outbox table is the contract the
sender will implement later.

### 3.6 Missing business rules are added, not scheduled
Two SPEC §7.1 functions do not exist and are not automation, so they ship:
`mark_overdue_and_late_fees()` (marks charges overdue after grace days, applies the org late-fee
rule once per charge; callable from the UI, no cron) and `issue_owner_statement(statement_id)`
(draft→review→issue, locks the statement, posts the management-fee journal per SPEC §7.8).

### 3.7 Role-aware landing
Sign-in and the authenticated layouts redirect by role: `tenant` → `/{locale}/portal`,
`owner` → `/{locale}/owner`, everyone else → `/{locale}/dashboard`. Platform admins land on
`/{locale}/platform`. Each route group has its own layout and shell; the portal shell is
mobile-first with a bottom navigation, the owner shell reuses the existing `AppShell` primitives
read-only.

## 4. Architecture

Route groups follow the SPEC §3 layout and stay separate so RLS and navigation stay honest:

```
src/app/[locale]/
  (app)/      staff workspace — existing, plus documents, meters, settings/*
  (owner)/    owner portal — read-only, own buildings
  (portal)/   tenant portal — own data, mobile-first
  (platform)/ super-admin console — service-role client, audited
  print/      printable documents (receipt, statement, contract)
```

Data access stays as it is today: Server Components read through the user-scoped Supabase client
so RLS applies; mutations are Server Actions validated by Zod schemas in `src/schemas/`; multi-step
financial operations remain Postgres RPCs. Platform-only reads use the service-role client.

Reuse over new code: `AppShell`, `SidebarNav`, `nav-items`, `visibleNav`, `src/lib/rbac`,
`src/lib/money`, `src/lib/dates`, `src/server/org-context`, `src/server/actions/*`. New shells
compose those primitives rather than fork them.

White-label mechanics: the middleware resolves the request host to an organization (custom domain
first, then `{slug}.{appHost}`), caches the mapping in-process for 60 seconds, and forwards the
resolved `org_id` and branding to the request. The locale layout reads the organization's branding
row and emits `--brand-primary`, `--brand-secondary` and `--brand-font` on the document element;
terminology overrides merge over the base next-intl messages server-side before
`NextIntlClientProvider`.

## 5. Data flow

1. Browser → Server Component / Server Action.
2. Server Component → user-scoped Supabase client → Postgres, filtered by RLS.
3. Server Action → Zod parse → capability check → Supabase RPC (financial operations) or table write.
4. Platform console → service-role client → write `audit_log` in the same transaction.

## 6. Error handling

Server Actions return a typed state (`{ error }` / `{ ok }`) with a message key, matching the
existing actions; forms render the error inline. RLS denials surface as "not authorised" rather
than stack traces. Missing rows redirect to the parent list. Storage upload failures leave the
record unsaved rather than storing a dangling path.

## 7. Verification (no test suites, per owner instruction)

- `pnpm lint` and `pnpm typecheck` clean after every phase.
- Migrations applied with `supabase db push --linked`; `src/types/database.ts` regenerated with
  `supabase gen types typescript --linked`.
- Policy behaviour probed with SQL against the linked project (read-only SELECT probes through the
  Supabase MCP server), following D-008's ad-hoc probe practice.
- Pages exercised by hand against the running dev server.

## 8. Risks

- **RLS rewrite blast radius**: P1 touches policies for the tables every screen reads. It lands
  first, alone, and staff behaviour is spot-checked before portals are added.
- **Tenant payment proof upload** creates a `pending_confirmation` payment with no allocation;
  staff must confirm it. That is SPEC §8 T1 behaviour and needs a staff-side confirmation screen
  to be useful — included in P4 as part of the payments screen.
- **Host→org middleware** adds a database read to the request path; the 60-second in-process cache
  keeps it off every render.
