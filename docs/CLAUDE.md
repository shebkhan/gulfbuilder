# CLAUDE.md

Project: Gulf Property Management Platform, a multi-tenant, white-label SaaS (buildings, floors, units, rooms, leases, deposits, rent, cheques, owners, financial reports).

**Read SPEC.md fully before starting any task.** SPEC.md defines what to build and in which order; this file defines how to work in the repo.

## Stack

- Next.js 15 (App Router, TypeScript strict), React 19
- Supabase: Postgres, Auth, Storage, Edge Functions, pg_cron
- Tailwind CSS, shadcn/ui, next-intl (en, ar), Zod, react-hook-form, TanStack Query, Recharts, printable HTML (browser print)
- Tests: Vitest (unit), Playwright (e2e), pgTAP (database and RLS)
- Package manager: pnpm

## Commands

```
pnpm install
pnpm dev                      # Next.js dev server
pnpm build
pnpm lint
pnpm typecheck
pnpm test                     # Vitest
pnpm test:e2e                 # Playwright (needs supabase running)
supabase start                # local stack
supabase db reset             # re-apply migrations + seed
supabase test db              # pgTAP tests
supabase migration new <name>
supabase gen types typescript --local > src/types/database.ts
```

Before declaring any task done, run: `pnpm lint && pnpm typecheck && pnpm test && supabase test db`.

## Architecture rules

- Multi-tenancy: one shared database. Every business table has `org_id`. RLS is enabled on every table with no exceptions. Never rely on application checks alone.
- Data access: Server Components and Server Actions use the Supabase server client with the signed-in user's session so RLS applies. The service-role client lives only in `src/lib/supabase/admin.ts` and may be imported only from Edge Functions and the `(platform)` route group.
- Mutations: Server Actions validated by Zod. Multi-step financial operations (record payment, activate lease, clear or bounce cheque, refund deposit, issue owner statement, close period) are Postgres functions (RPC) so they are atomic.
- Money: integer minor units (`bigint` in SQL, `number` or `bigint` in TS) plus currency code. Never use floating point for money. Format only through `src/lib/money.ts`. KWD, BHD and OMR have 3 decimals.
- Ledger: `journals` and `journal_lines` are immutable. Correct by posting a reversing journal. Posting into a closed period must fail.
- Dates: business dates are `date`, events are `timestamptz` (UTC). Display Gregorian by default, Hijri optional.
- Soft delete (`deleted_at`) for master data. Never hard-delete rows referenced by leases, payments or journals.

## Code conventions

- TypeScript strict, no `any`. Zod schemas live in `src/schemas/` and are shared by client and server.
- Files: kebab-case. React components: PascalCase. DB: snake_case, plural table names.
- Server Components by default; add `use client` only when needed.
- All user-visible strings go through next-intl (`messages/en.json`, `messages/ar.json`). No hard-coded text.
- RTL: use logical Tailwind utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`). Never use `left`/`right`, `ml-`/`mr-`, `pl-`/`pr-`.
- Branding: colors and fonts come from CSS variables set per organization. Do not hard-code brand colors in components.
- Keep components small. Domain components in `src/components/domain/`, primitives in `src/components/ui/`.
- Generated DB types (`src/types/database.ts`) must be regenerated after every migration.

## Database rules

- Schema changes only through new files in `supabase/migrations/` (timestamped). Never edit an applied migration.
- Every new table: `org_id`, `created_at`, `updated_at`, `created_by`, RLS enabled, policies written, pgTAP test added, index on `(org_id, ...)` for filtered columns.
- Constraints and triggers enforce integrity rules in the database (see SPEC.md section 5 and 7), not only in the UI.

## Security rules

- Never log or expose ID numbers, tokens or the service-role key. ID numbers are encrypted at rest via Postgres `encrypt_id`/`decrypt_id` (Vault + pgcrypto); see D-011.
- Storage paths start with `{org_id}/`; bucket policies check that prefix. Use signed URLs.
- Add a cross-tenant test (user in org A cannot read or write org B) for every new table.
- Do not add third-party services or dependencies without noting them in `docs/DECISIONS.md`.

## Testing rules

- Write tests with the code, not after. pgTAP for RLS, constraints, triggers and RPC functions; Vitest for pure logic (money, schedule generation, allocation, KPIs); Playwright for key flows in both `en` and `ar`.
- Seed data (`supabase/seed.sql`) must provide a demo organization (Qatar, QAR) so every screen has data.

## Working agreement

- Follow SPEC.md milestone order. Do not start a milestone before the previous one's Definition of Done passes.
- At the start of a milestone, post a short plan (files to add or change), then implement in small commits.
- If the spec is ambiguous or marks something `TODO(owner)`, ask. Do not guess.
- Never invent legal, tax or regulatory values. Use placeholders marked `TODO(verify)` in market pack data.
- Record any deviation from the spec in `docs/DECISIONS.md` with the reason.
- Do not refactor unrelated code while implementing a task.
