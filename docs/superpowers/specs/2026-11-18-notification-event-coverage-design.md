# Notification event coverage (sub-project 1B)

## Problem

1A made `notification_outbox` drain to email, SMS, Telegram and web push. But only
`cheque_bounced` ever enqueues a row, and no enqueue path consults `notification_templates`.
The template editor is therefore dead at send time, and the business events the product promises
(payment received, overdue rent, lease expiry, maintenance activity, document expiry) never notify
anyone. `organizations.settings->>'reminder_days'` is written by settings but read by nothing.

## Goal

Enqueue notifications for the missing business events, render each message from the organization's
templates with a localized built-in fallback, and run idempotent expiry reminders inside the
existing dispatch tick. No new scheduler, no new dependency, no new channel.

## Decisions

- **Email is the enqueue channel in 1B.** Every new event enqueues an `email` row. The delivery core
  already supports SMS/Telegram/push, but only email has a universally available address; fan-out to
  the other channels is a later change. Templates for other channels may be stored but are not read
  by 1B enqueuers.
- **Triggers for row events, one scan RPC for time-based events.** Row events (payment, charge
  overdue, maintenance create/status) are `after` triggers so every write path is covered, including
  direct staff writes. Expiry reminders are a security-definer scan called by `dispatchPending()`
  before it claims the batch, so the owner still supplies exactly one external cron.
- **Templates with fallback, no seeding.** `render_notification()` looks up the exact locale,
  then `en`, then a built-in localized default. No default rows are inserted into
  `notification_templates`; the editor stays opt-in.
- **The overdue sweep runs inside the dispatch tick.** `mark_overdue_and_late_fees()` is
  per-org (`auth_org()`) and role-guarded, so it can never run from the cron path and
  `rent_overdue` would only fire if a staff member clicked the manual button. Its body is
  extracted into an all-org-capable `sweep_overdue(p_org uuid default null)`; the existing
  function becomes the role-checked wrapper it is today, and the reminder scan calls the
  extracted body. One rule, two callers, no drift.
- **Idempotency in the database.** Add `notification_outbox.dedupe_key` with a partial unique index
  and have the enqueue helper `on conflict do nothing`. Reminder scans run every minute and must not
  duplicate.
- No change to `cheque_bounced` except that it keeps its existing direct insert (no dedupe key).

## Design

### 1. Migration `20261118000047_notification_events.sql`

Schema:

```sql
alter table public.notification_outbox add column dedupe_key text;
create unique index notification_outbox_dedupe_idx
  on public.notification_outbox (org_id, event, dedupe_key)
  where dedupe_key is not null;
```

### 2. Rendering and enqueue helpers

```sql
-- Exact locale template, then 'en' template, then a built-in default for (event, locale).
-- Replaces {{token}} with each key of p_payload.
create function public.render_notification(
  p_org uuid, p_event text, p_channel text, p_locale text, p_payload jsonb
) returns table (subject text, body text)
  language plpgsql security definer set search_path = public;
```

Built-in defaults (English and Arabic) cover `payment_received`, `rent_overdue`,
`lease_expiring`, `maintenance_requested`, `maintenance_status_changed` and `document_expiring`.
Token interpolation is a loop over `jsonb_each_text(p_payload)` using `replace()`. Unknown events
fall back to `(p_event, p_payload->>'title')`.

```sql
create function public.enqueue_notification(
  p_org uuid, p_event text, p_channel text, p_recipient text,
  p_locale text, p_payload jsonb, p_dedupe_key text
) returns void
  language plpgsql security definer set search_path = public;
```

`enqueue_notification` returns early when `p_recipient` is null/blank, renders via
`render_notification`, and inserts into `notification_outbox` with `status='pending'`,
`scheduled_for=now()` and `on conflict (org_id, event, dedupe_key) where dedupe_key is not null
do nothing`. Execute is revoked from `public` and granted to nothing: only the security-definer
triggers and scan call it as the owner.

### 3. Row-event triggers

All trigger functions are `security definer set search_path = public`; they write only the outbox.

| Trigger | Event | Recipient | Dedupe key | Payload |
|---|---|---|---|---|
| `after insert on payments` | `payment_received` | `tenants.email` via `payments.tenant_id` | `payment:<payment id>` | `receipt_no`, `amount` (formatted), `currency`, `tenant_name` |
| `after update of status on charges` when `new.status='overdue' and old.status is distinct from 'overdue'` | `rent_overdue` | tenant email via `charges.lease_id → leases.tenant_id → tenants.email` | `charge-overdue:<charge id>` | `amount`, `currency`, `due_date`, `lease_no` |
| `after insert on maintenance_requests` | `maintenance_requested` | each staff email for `org_admin`, `manager`, `caretaker` | `maintenance-requested:<request id>` | `title`, `unit_no`, `status` |
| `after update of status on maintenance_requests` when status changed | `maintenance_status_changed` | `tenants.email` via `tenant_id` (skip if null) | `maintenance-status:<request id>:<new status>` | `title`, `status`, `unit_no` |

Money is formatted for display in the trigger as
`to_char(amount_minor / 100, 'FM999,999,990.00') || ' ' || currency`; the ledger value is untouched.

Staff recipient helper: inline `select u.email from org_members m join auth.users u on u.id=m.user_id
where m.org_id=... and m.role in (...)`, skipping null emails. Tenant emails come from `tenants.email`
and are skipped when null.

### 4. Overdue sweep extraction

```sql
-- Same marking and late-fee logic as mark_overdue_and_late_fees, but callable for one
-- org or (p_org is null) for every org. No auth checks inside; callers own them.
create function public.sweep_overdue(p_org uuid default null) returns integer
  language plpgsql security definer set search_path = public;
```

`mark_overdue_and_late_fees()` keeps its signature, role guard and grant, and becomes
`select public.sweep_overdue(auth_org())` after the guard. `sweep_overdue` is revoked from
`public` and granted to nothing; the wrapper and the scan call it as owner. `auth_org()` is
never referenced inside `sweep_overdue`.

### 5. Expiry reminder scan

```sql
create function public.enqueue_notification_reminders() returns void
  language plpgsql security definer set search_path = public;
```

Called once per dispatch tick. It first calls `public.sweep_overdue(null)` so the `charges`
status trigger fires for every org, then enqueues the time-based reminders. It is set-based
and idempotent via `dedupe_key`:

- **Lease expiry:** `leases` with `status='active'` and `end_date` between `current_date` and
  `current_date + coalesce((organizations.settings->>'reminder_days')::int, 30)`.
  Recipient: staff (`org_admin`, `manager`). Dedupe key `lease-expiring:<lease_id>:<end_date>`
  (including `end_date` so a renewed lease with a new date reminds again).
- **Document expiry:** `documents` with `expires_on` between `current_date` and
  `current_date + 30`. Recipient: staff (`org_admin`, `manager`, `caretaker`). Dedupe key
  `document-expiring:<document_id>:<expires_on>`.

`grant execute on function public.enqueue_notification_reminders() to service_role;`

### 6. Dispatch worker

In `src/server/notifications/dispatch.ts`, call
`admin.rpc("enqueue_notification_reminders")` between `linkTelegramCodes(admin)` and
`claim_notification_batch`, and throw on an RPC error (consistent with the claim call). Add a
Vitest case asserting the scan RPC is called before the claim RPC.

### 7. Generated types

Add `dedupe_key: string | null` to `notification_outbox` Row, and optional `dedupe_key?: string | null`
to Insert and Update in `src/types/database.ts`. No other type changes.

### 8. Documentation

- `docs/runbook.md`: add the new events to the dispatch section and add pre-deploy SQL probes:
  render fallback, dedupe on re-run, payment trigger inserts one row, overdue transition inserts one
  row, status change inserts one row, and the scan is idempotent across two calls.
- No `.env.example` change; no new configuration.

## Architecture deviations

No new third-party service or dependency. The triggers and helper functions are security-definer
functions owned by the migration, which is the established pattern for enqueue RPCs
(`bounce_cheque` already inserts into the outbox this way). No `DECISIONS.md` entry is required.

## Verification

Owner excluded automated suites from release gates.

- `pnpm lint` and `pnpm typecheck` (modulo two pre-existing errors from concurrent work:
  `src/components/ui/date-picker.tsx:58`, `src/lib/i18n-keys.test.ts:28,64` — not touched here).
- `pnpm test src/server/notifications/` — new dispatch-scan ordering test.
- SQL probes cannot run in this environment (no local Postgres; remote is owner-gated). They are
  written into `docs/runbook.md` as mandatory pre-deploy checks, alongside the 1A probes.

## Known limits

- Seeding demo data writes real outbox rows to the seeded staff/tenant emails, because the triggers
  fire on seed inserts too. Acceptable in dev; truncate `notification_outbox` after a seed if the
  noise matters.
- A maintenance request that returns to a status it already notified (open → in_progress → open)
  is deduped and sends no second email.

## Out of scope

- SMS/Telegram/push fan-out for the new events (email only in 1B).
- A separate `late_fee_applied` event; the late fee is part of the same overdue sweep and the
  `rent_overdue` row is the notification for that month.
- Quiet hours, per-user channel opt-outs, digest batching.
- Notifying the platform team, owner portal users or `caretaker` on tenant events beyond the rows
  above.
- Scheduled reports, PDF storage, bank reconciliation and the other feature-gap buckets.
- Building UI for choosing events or seeding default templates.
- Fixing the pre-existing `maintenance_requests` status enum mismatch or the seed `'queued'` status.
