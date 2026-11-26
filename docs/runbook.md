# Runbook

## Deploy

1. Install Node dependencies (`npm ci` or `pnpm install --frozen-lockfile`) and set the
   environment variables below.
2. Link the Supabase project once: `supabase link --project-ref <ref>` (the project is
   configured as `gulfproperty` in `.env.example`).
3. Apply schema changes: `pnpm db:push` (`supabase db push --linked`). Migrations are
   timestamped (`202611160000NN_*.sql` and later) and are never edited after they have
   been applied.
   Regenerate the typed client with `pnpm gen:types` after every migration.
4. Verify the release: `pnpm lint && pnpm typecheck && pnpm build`. The owner excluded
   automated test suites from v1, so these plus read-only SQL probes are the gates.
5. Start with `pnpm start`, or run `pnpm dev` locally. Point the custom-domain host at the
   app and set `NEXT_PUBLIC_APP_HOST` to the bare host used for `{slug}.{host}` tenant
   routing (defaults to `localhost`).

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project API URL; public. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key; RLS is the gate. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; used by the `(platform)` console, invites and storage admin. Never ship to the browser. |
| `NEXT_PUBLIC_APP_HOST` | Bare host used by host-to-organization resolution and subdomains; default `localhost`. |

`ID_ENCRYPTION_KEY` is retired: tenant ID encryption moved into Postgres Vault in M2
(see D-011). A `.env.local` based on `.env.example` is enough for local work.

## Database operations

- **Migrations:** `pnpm db:push` applies new files to the linked project. `supabase db
  reset` is not used — development runs directly against hosted Supabase (D-001).
- **Ad hoc probes:** run read-only SQL through the Supabase SQL editor or the MCP client
  inside a rolled-back transaction. `pnpm db:test` is retained for environments where
  Supabase CLI can reach Docker (D-008).
- **Backup and restore:** use the Supabase project's scheduled backups and point-in-time
  recovery from the dashboard. Before any bulk write, record the current migration
  version (`supabase migration list --linked`) and export the affected tables. Restore
  into a fresh project first and replay migrations forward; never restore over a live
  project without owner approval.
- **Storage:** the private `documents` bucket holds `{org_id}/{entity}/{id}/{file}`.
  The `listing-images` bucket is public-read so search engines can crawl listing
  photos; writes stay under `{org_id}/` (D-026). A backup must include both buckets
  and the database.

## Public marketplace

- Routes `/{locale}`, `/{locale}/properties` and `/{locale}/properties/{slug}` are
  anonymous and read the `public_listings` view; `/{locale}/listings/enquiries` is
  session-gated. `sitemap.xml` and `robots.txt` are generated from the app.
- `20261119000002_public_marketplace.sql` has only been hand-verified in the build
  environment: local Postgres/Docker was unavailable, so `supabase test db` and
  Playwright did not run. Before deploying, apply it to a local stack and run
  `supabase db reset`, `supabase test db` (including
  `supabase/tests/0004_public_marketplace_test.sql`) and `pnpm test:e2e`, then
  regenerate `src/types/database.ts` from the applied schema.
- Add a rate limit in front of the enquiry action before exposing the marketplace
  to the open internet (D-027). Listing copy, flags and images have no admin UI yet;
  they are set in the database. The WhatsApp share/deep-link number comes from
  `org_integrations.config.phone` for provider `whatsapp` (platform organization
  console).

## Notification dispatch

`POST /api/notifications/dispatch` drains queued `notification_outbox` rows across
email, SMS, Telegram and web push. It requires
`Authorization: Bearer $NOTIFICATION_CRON_SECRET` (set `NOTIFICATION_CRON_SECRET`
in the environment); unauthenticated calls get 401. The recommended cadence is
every minute. The cron caller is supplied by the owner — no Edge Function, pg_cron
or scheduler is configured here. For local testing, set `NOTIFICATION_DRY_RUN=1`
to exercise the dispatch path without delivering messages.

The events enqueued are: `cheque_bounced`, `payment_received`, `rent_overdue`,
`maintenance_requested`, `maintenance_status_changed`, `lease_expiring` and
`document_expiring`. Each dispatch tick runs `enqueue_notification_reminders`
first — it sweeps overdue charges and scans for lease/document expiry for every
org — before calling `claim_notification_batch`. One external cron (the minute
call above) therefore still covers everything; no second scheduler is needed.
A scan failure aborts that tick: the RPC error is raised and no rows are claimed
or delivered until the next tick succeeds.

**Before deploying `20261117000046_notification_delivery.sql` (1A):** the migration
has never been applied to a real database (no local Postgres in the build
environment). Run `supabase db reset` on a local stack and confirm: (a) the
migration applies cleanly; (b) `claim_notification_batch` returns a due pending
row but **not** one whose `scheduled_for` is in the future; (c) a stale claim
(>5 min) is reclaimed; (d) an authenticated update of an existing
`web_push_subscriptions` row passes the `update` RLS policy. Then regenerate
`src/types/database.ts` from the applied migration to confirm the hand-edited
types before any remote push.

**Before deploying `20261118000048_notification_events.sql` (1B):** run the pgTAP
suite — `supabase test db` on a local stack, or `pnpm db:test --linked` against a
staging branch — and confirm `supabase/tests/notification_events_test.sql` passes.
`pnpm db:test --linked` must be run by the owner/superuser, because the pgTAP suite
directly calls `render_notification` and `enqueue_notification`, which are revoked from
`public` with no grants; a non-owner harness cannot execute those assertions.
Then, in staging, run `select public.enqueue_notification_reminders();` twice and
confirm the `lease_expiring` and `document_expiring` row counts are unchanged
after the second call (the scan is idempotent and does not re-enqueue duplicates).

## Known gaps (v1 scope)

- No Vitest, pgTAP, Playwright, CI or load/restore suites are run as release gates.
- No bank reconciliation: bank accounts exist, but CSV bank import and matching are
  phase-2 work.
- Reporting snapshots are generated on demand; materialized views and scheduled report
  delivery are not set up.
- Tenant-facing documents are printable HTML, not generated PDF files (D-014).
