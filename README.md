# Gulf Property Management Platform

Multi-tenant, white-label SaaS for property companies in the Gulf: buildings, floors, units, rooms, leases, deposits, rent collection (post-dated cheques), maintenance, expenses, owner statements and financial analytics. Also includes an additive public marketplace for opted-in vacant units (browse, filter, listing detail, enquiries and an org lead inbox). First market Qatar (QAR); UAE, Saudi Arabia, Kuwait, Bahrain and Oman follow via market packs.

## Stack

Next.js 15 (App Router, TypeScript strict) + Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron), Tailwind + shadcn/ui, next-intl (en, ar), Zod, Vitest, Playwright, pgTAP. Package manager: pnpm.

## Docs

- `docs/SPEC.md` — product and build specification (authoritative for behavior).
- `docs/CLAUDE.md` — repo conventions, commands, architecture rules.
- `docs/admin-guide.md` — operator walkthrough.
- `docs/runbook.md` — deploy, environment, operations.
- `docs/DECISIONS.md` — deviations from the spec.
- `docs/design_brief/` — UI/design notes.

## Commands

```bash
pnpm install
pnpm dev          # dev server
pnpm build
pnpm lint
pnpm typecheck
pnpm test         # Vitest unit tests
pnpm test:e2e     # Playwright (needs Supabase running)
pnpm db:push      # apply migrations
pnpm db:test      # pgTAP (supabase test db --linked)
pnpm gen:types    # regenerate src/types/database.ts
```

Before declaring a task done: `pnpm lint && pnpm typecheck && pnpm test && supabase test db`.

## Tests

- Vitest: `src/**/*.test.ts` — pure logic (money, schedule, allocation, KPIs, Zod schemas, notifications helpers, white-label, marketplace helpers and SEO metadata).
- pgTAP: `supabase/tests/` — RLS, constraints, triggers, RPCs, ownership rules, marketplace anon access.
- Playwright: `e2e/` — key flows in `en` and `ar`, including marketplace browse → filter → detail → enquiry.

## Layout

See `docs/SPEC.md` §3 for the full repository layout and request flow. Key directories: `src/app`, `src/components`, `src/lib`, `src/schemas`, `src/server`, `src/types`, `supabase/migrations`, `supabase/tests`, `messages`.