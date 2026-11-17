# Notification delivery core (sub-project 1A)

## Problem

`notification_outbox` is written but never drained. D-017 excluded automation from v1, so
`cheque_bounced` is the only event that enqueues anything, and nothing delivers even that. The
settings screen also selects an `attempts` column that does not exist, so its outbox list fails.
Adding delivery without first proving it against real rows would hide bugs behind new enqueue
paths.

## Goal

Drain pending outbox rows to four channels with retries, let users link Telegram and subscribe to
web push, and let an admin trigger a drain manually. No new business events are enqueued in 1A.

## Decisions

- Split the notification gap into **1A (delivery core)** and **1B (event coverage)**. This spec is
  1A only; 1B is a separate spec/plan.
- Channels: **email (Resend), SMS (Twilio), Telegram Bot API, web push**. WhatsApp is out of scope.
- Trigger: a secret-protected Next.js dispatch route called by an external cron, plus an admin
  "Send now" button that calls the same worker directly. No Supabase Edge Function or pg_cron.
- Telegram self-link: the user generates a code in settings and sends `/start CODE` to the bot.
  The worker polls `getUpdates` once per tick; no webhook endpoint.
- One `Notifier` interface; provider SDKs/HTTP calls never appear in business logic.

## Design

### 1. Migration `20261117000046_notification_delivery.sql`

- `notification_outbox`: add `attempts int not null default 0` and `claimed_at timestamptz`. Keep
  the existing `pending/sent/failed` status check — a claim is `claimed_at`, not a new status.
- `profiles`: add `telegram_chat_id text`, `telegram_link_code text`, `telegram_link_expires_at
  timestamptz`.
- `telegram_state`: singleton row (`id boolean primary key default true`, `last_update_id bigint
  not null default 0`). RLS enabled, no client policies — service role only. This is an
  infrastructure table, not an `org_id` business table.
- `web_push_subscriptions`: `id`, `org_id`, `user_id`, `endpoint` (unique), `p256dh`, `auth`,
  `created_at`, `updated_at`, `created_by`. RLS enabled; a member may select, insert and delete
  only their own subscriptions in their own org. Index on `(org_id, user_id)`.
- `claim_notification_batch(p_limit int default 50)`: `security definer`, `set search_path = public`,
  selects pending rows with `claimed_at is null or claimed_at < now() - interval '5 minutes'`
  ordered by `scheduled_for`, `for update skip locked`, sets `claimed_at = now()`, returns the
  claimed rows. Execute granted to `service_role` only.
- No change to any existing enqueue path, trigger or RPC.

### 2. Notifier interface and adapters

`src/server/notifications/notifier.ts` defines:

```ts
type Channel = "email" | "sms" | "telegram" | "push";
type Outbound = { channel: Channel; recipient: string; subject?: string | null; body: string };
type SendResult = { ok: true } | { ok: false; error: string };
interface Notifier { send(message: Outbound): Promise<SendResult> }
```

Adapters in `src/server/notifications/notifiers/`:

- **Resend** — `POST https://api.resend.com/emails` with `RESEND_API_KEY`. From address is
  `NOTIFICATION_FROM_EMAIL`, falling back to the org's `org_branding.email_from`.
- **Twilio SMS** — `POST /2010-04-01/Accounts/{sid}/Messages.json` with basic auth
  (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`).
- **Telegram** — `POST https://api.telegram.org/bot{token}/sendMessage` with
  `TELEGRAM_BOT_TOKEN`; `chat_id` comes from the resolved profile.
- **Web push** — `web-push` npm package with `WEB_PUSH_VAPID_PUBLIC_KEY`,
  `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`; one send per subscription row.

Missing provider config returns `{ ok: false, error: "not_configured" }`. With
`NOTIFICATION_DRY_RUN=1`, every adapter logs the message and returns success without a network
call. No credentials or message bodies are logged in normal mode.

### 3. Dispatch worker

`src/server/notifications/dispatch.ts` exports `dispatchPending(): Promise<DispatchSummary>`:

1. Poll Telegram `getUpdates` once, using `telegram_state.last_update_id` as offset; link any
   `/start CODE` messages (see §4), then persist the new offset.
2. Claim up to 50 rows with `claim_notification_batch` through the admin client.
3. For each row, resolve `recipient` by channel:
   - `email` → email address, `sms` → E.164 number (both already stored as-is).
   - `telegram` → `profiles.telegram_chat_id` for the user id in `recipient`.
   - `push` → all `web_push_subscriptions` rows for that user id.
   Document this convention in the worker file.
4. Call the channel's Notifier. Success: `status = 'sent'`, `sent_at = now()`, clear `error`.
5. Failure: increment `attempts`; failures 1, 2 and 3 reschedule for `now() + 1 minute`, `+ 5
   minutes` and `+ 25 minutes`; a fourth failure sets `status = 'failed'`. Store the error text.
   Claims older than five minutes are reclaimable so a crashed run never strands a row.

`src/app/api/notifications/dispatch/route.ts` handles `POST` only, requires
`Authorization: Bearer <NOTIFICATION_CRON_SECRET>`, calls `dispatchPending()` and returns the
summary as JSON; a wrong or missing secret gets 401. Middleware already excludes `/api`.

The admin "Send now" action in `src/server/actions/settings.ts` checks `settings.write` and calls
the same `dispatchPending()` function in-process — it does not call the HTTP route.

### 4. Telegram self-link

A server action generates a six-digit code, stores it on the acting user's profile with a
ten-minute expiry, and shows it in settings alongside `TELEGRAM_BOT_USERNAME`. The user sends
`/start CODE` to that bot. On the next dispatch tick the worker's `getUpdates` poll
matches the code to a profile whose code has not expired, writes `telegram_chat_id`, clears the
code and expiry, and advances `last_update_id`. Codes are single-use. No webhook or callback
route is created.

### 5. Web push

`public/sw.js` handles `push` by showing a notification from the encrypted payload and
`notificationclick` by focusing the app. A small client component in settings registers the
service worker, calls `pushManager.subscribe` with the VAPID public key and posts the subscription
to a server action that upserts it into `web_push_subscriptions` with the acting user's `org_id`.
An "unsubscribe" action deletes the row and the browser subscription.

### 6. Settings UI and translations

`settings/notifications` gains three cards: Telegram self-link (code + bot username + linked
state), web push enable/disable, and "Send now" on the existing outbox card. The outbox list keeps
its current columns — the `attempts` select now resolves after the migration. All new strings go
into `messages/en.json` and `messages/ar.json` under `settings.notifications`; RTL uses logical
utilities only.

### 7. Configuration

Add to `.env.example`: `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`, `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`,
`WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`,
`NOTIFICATION_CRON_SECRET`, `NOTIFICATION_DRY_RUN`. Include a comment on generating VAPID keys
with `npx web-push generate-vapid-keys`.

## Architecture deviations

Record both in `docs/DECISIONS.md` as D-018 and D-019 during implementation:

- `docs/CLAUDE.md` restricts the service-role client to Edge Functions and the `(platform)` route
  group. The dispatch route and worker need cross-org access to the outbox. The Next.js route is
  the chosen trigger, so the worker imports the existing admin client; no second client is added.
- A third-party dependency (`web-push`) and three outbound services (Resend, Twilio, Telegram)
  are introduced; per `docs/CLAUDE.md` they must be recorded in `DECISIONS.md`.

## Verification

Owner excluded automated suites from v1 release gates. Verify with `pnpm lint` and
`pnpm typecheck`; add a small Vitest file for Notifier channel routing, the backoff schedule and
the `/start CODE` parser because that logic is non-trivial. Regenerate `src/types/database.ts`
from the migration (`supabase gen types typescript --local`, or hand-edit if the local stack is not
running). Apply the migration to a local stack only, then seed one outbox row per channel and call
the dispatch route with a bad secret (401) and with a valid secret in dry-run mode (rows go to
`sent`). Do not run `supabase db push --linked` or regenerate types from the linked project
without the owner's approval.

## Out of scope

- WhatsApp, email/WhatsApp templates beyond the existing `notification_templates` editor.
- Any new event enqueue, reminder scan, scheduled email delivery or scheduled report (1B).
- Quiet hours and per-user channel opt-outs.
- Stored PDFs, bank reconciliation, and the rest of the feature-gap buckets.
- Remote deployment or cron provider setup — the owner supplies the cron caller and credentials.
