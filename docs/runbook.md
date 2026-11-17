# Runbook

## Deploy

1. Install Node dependencies (`npm ci` or `pnpm install --frozen-lockfile`) and set the
   environment variables below.
2. Link the Supabase project once: `supabase link --project-ref <ref>` (the project is
   configured as `gulfproperty` in `.env.example`).
3. Apply schema changes: `pnpm db:push` (`supabase db push --linked`). Migrations are
   numbered `202611160000NN_*.sql` and are never edited after they have been applied.
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
  A backup must include both the database and this bucket.

## Notification dispatch

`POST /api/notifications/dispatch` drains queued `notification_outbox` rows across
email, WhatsApp, SMS, Telegram and web push. It requires
`Authorization: Bearer $NOTIFICATION_CRON_SECRET` (set `NOTIFICATION_CRON_SECRET`
in the environment); unauthenticated calls get 401. The recommended cadence is
every minute. The cron caller is supplied by the owner — no Edge Function, pg_cron
or scheduler is configured here. For local testing, set `NOTIFICATION_DRY_RUN=1`
to exercise the dispatch path without delivering messages.

## Known gaps (v1 scope)

- No Vitest, pgTAP, Playwright, CI or load/restore suites are run as release gates.
- No bank reconciliation: bank accounts exist, but CSV bank import and matching are
  phase-2 work.
- Reporting snapshots are generated on demand; materialized views and scheduled report
  delivery are not set up.
- Tenant-facing documents are printable HTML, not generated PDF files (D-014).
