# Notification delivery core (1A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drain `notification_outbox` to email, SMS, Telegram and web push with claim, retry and a manual trigger.

**Architecture:** A `Notifier` interface with four adapters is driven by a single `dispatchPending()` worker. The worker claims rows through a Postgres RPC (`for update skip locked`), resolves `recipient` into channel-specific outbound messages, then records success or a backoff. A secret-protected Next.js route and an admin "Send now" action both call the same worker; Telegram codes are linked by polling `getUpdates` in the worker, with no webhook.

**Tech Stack:** Next.js 15 App Router, Supabase Postgres + JS client, Resend/Twilio/Telegram HTTP APIs, `web-push`, Vitest, next-intl, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-11-17-notification-delivery-core-design.md`

## Global Constraints

- Money is integer minor units; no notification code touches money values.
- RLS enabled on every new business table; every new table has `org_id`, `created_at`, `updated_at`, `created_by`, policies and an `(org_id, ...)` index.
- All user-visible strings go through next-intl (`messages/en.json`, `messages/ar.json`); no hard-coded UI text.
- RTL uses logical Tailwind utilities only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`).
- Generated DB types (`src/types/database.ts`) must match migrations.
- No `supabase db push --linked`, `--linked` type generation, remote deploy or cron setup without owner approval.
- Third-party services and deviations from `docs/CLAUDE.md` are recorded in `docs/DECISIONS.md`.

## Review Focus

- **Missing provider credentials:** an adapter with no env config returns `{ ok: false, error: "not_configured" }` and makes no network call — test in Task 2.
- **Two dispatch ticks overlap:** no row is claimed twice — `claim_notification_batch` uses `for update skip locked`; SQL probe in Task 1.
- **Worker crashes after claiming:** rows with `claimed_at` older than five minutes are reclaimable — SQL probe in Task 1.
- **Telegram `/start CODE` with an expired or reused code:** no link is written and the row is not retried — unit test in Task 4.
- **Wrong or missing cron secret:** dispatch route returns 401 and does not call the worker — HTTP probe in Task 5.

---

### Task 1: Migration, generated types and decisions

**Files:**
- Create: `supabase/migrations/20261117000046_notification_delivery.sql`
- Modify: `src/types/database.ts`, `docs/DECISIONS.md`

**Interfaces:**
- Produces: `claim_notification_batch(p_limit int default 50)` returning `notification_outbox` rows; new `attempts`/`claimed_at` columns; `profiles.telegram_chat_id`, `telegram_link_code`, `telegram_link_expires_at`; `telegram_state`; `web_push_subscriptions`.

- [ ] **Step 1: Write the migration**

In `supabase/migrations/20261117000046_notification_delivery.sql`:

- `alter table notification_outbox add column attempts int not null default 0, add column claimed_at timestamptz;` Keep the existing `pending/sent/failed` check unchanged.
- Add `'telegram'` to the `channel` checks on both `notification_outbox` and `notification_templates`. Keep `'whatsapp'` in the checks for existing data even though no adapter ships in 1A.
- `alter table profiles add column telegram_chat_id text, add column telegram_link_code text, add column telegram_link_expires_at timestamptz;`
- `create table telegram_state (id boolean primary key default true, last_update_id bigint not null default 0);` RLS enabled, no client policies (service role only), single row inserted with `id = true`.
- `create table web_push_subscriptions (id uuid primary key default gen_random_uuid(), org_id uuid not null references organizations(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, endpoint text not null unique, p256dh text not null, auth text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid);` Enable RLS; add `(org_id, user_id)` index; policies for `select`, `insert`, `delete` with `org_id = auth_org() and user_id = auth.uid()`; add the `set_updated_at` trigger.
- `create function claim_notification_batch(p_limit int default 50) returns setof notification_outbox language plpgsql security definer set search_path = public` — select `status = 'pending' and (claimed_at is null or claimed_at < now() - interval '5 minutes')` ordered by `scheduled_for`, `for update skip locked limit p_limit`, set `claimed_at = now()` for those rows, return them. `revoke all ... from public; grant execute ... to service_role;`

- [ ] **Step 2: Apply locally and run the claim probes**

Run: `supabase db reset` (local stack only)
Probe 1: insert two pending rows, call `select count(*) from claim_notification_batch(1);` twice in separate transactions — expected `1` then `1`, different row ids.
Probe 2: set a row's `claimed_at = now() - interval '6 minutes'`, call `claim_notification_batch(50)` — expected the row is returned.

- [ ] **Step 3: Update generated types**

Run: `supabase gen types typescript --local > src/types/database.ts`. If the local stack is unavailable, hand-edit `src/types/database.ts` to add the four new columns, the two new tables and the new function signature, matching the migration exactly.

- [ ] **Step 4: Record deviations in `docs/DECISIONS.md`**

Add, newest first: **D-018** — the service-role client is imported by `src/server/notifications/*` and `src/app/api/notifications/dispatch/*` instead of only Edge Functions and `(platform)`, because the worker must drain all orgs' outbox rows and the chosen trigger is a Next.js route. **D-019** — `web-push` dependency and Resend, Twilio and Telegram services are introduced for delivery; WhatsApp remains unimplemented.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261117000046_notification_delivery.sql src/types/database.ts docs/DECISIONS.md
git commit -m "feat(notifications): outbox claims, telegram link and push subscription schema"
```

### Task 2: Notifier interface and four adapters

**Files:**
- Create: `src/server/notifications/notifier.ts`, `src/server/notifications/notifiers/index.ts`, `src/server/notifications/notifiers/resend.ts`, `src/server/notifications/notifiers/twilio.ts`, `src/server/notifications/notifiers/telegram.ts`, `src/server/notifications/notifiers/web-push.ts`, `src/server/notifications/notifier.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing from Task 1 at runtime beyond the channel names.
- Produces: `CHANNELS`, `Channel`, `Outbound`, `SendResult`, `Notifier`, `notifierFor(channel): Notifier | null`, `isDryRun(): boolean`; each adapter exports a `Notifier`.

- [ ] **Step 1: Write the failing routing test**

In `src/server/notifications/notifier.test.ts`, assert: `notifierFor("email")`, `notifierFor("sms")`, `notifierFor("telegram")` and `notifierFor("push")` each return an object with a `send` function; `notifierFor("whatsapp" as Channel)` returns `null`; with `NOTIFICATION_DRY_RUN=1`, `isDryRun()` returns `true`.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test src/server/notifications/notifier.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the interface and adapters**

Create `notifier.ts` with:
```ts
export const CHANNELS = ["email", "sms", "telegram", "push"] as const;
export type Channel = (typeof CHANNELS)[number];
export type Outbound = {
  channel: Channel;
  recipient: string;
  subject?: string | null;
  body: string;
  subscription?: { endpoint: string; p256dh: string; auth: string };
};
export type SendResult = { ok: true } | { ok: false; error: string };
export interface Notifier { send(message: Outbound): Promise<SendResult> }
export function isDryRun(): boolean; // process.env.NOTIFICATION_DRY_RUN === "1"
```
`isDryRun()` short-circuits every adapter: log `channel` and `recipient` only, return `{ ok: true }`. Each adapter reads `process.env` at call time (never at import time), returns `{ ok: false, error: "not_configured" }` when required values are absent, and otherwise uses `fetch` to: Resend `https://api.resend.com/emails`; Twilio `https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json` with basic auth; Telegram `https://api.telegram.org/bot{token}/sendMessage`; web push via `web-push`'s `sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: subject ?? "Notification", body }))` where `s = message.subscription`. Never log tokens, chat IDs, phone numbers or message bodies in normal mode. Add `web-push` to `package.json` dependencies with `pnpm add web-push`.

- [ ] **Step 4: Run the test**

Run: `pnpm test src/server/notifications/notifier.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/server/notifications/
git commit -m "feat(notifications): notifier interface and four delivery adapters"
```

### Task 3: Backoff, recipient resolution and dispatch worker

**Files:**
- Create: `src/server/notifications/backoff.ts`, `src/server/notifications/backoff.test.ts`, `src/server/notifications/recipient.ts`, `src/server/notifications/recipient.test.ts`, `src/server/notifications/dispatch.ts`
- Modify: `src/lib/supabase/admin.ts`

**Interfaces:**
- Consumes: `Notifier`, `Outbound`, `CHANNELS`, `notifierFor` from Task 2; `claim_notification_batch` from Task 1.
- Produces: `retryAt(attempts: number, from: Date): Date | null` (attempts 1→+1min, 2→+5min, 3→+25min, 4→`null`); `resolveOutbound(row, admin): Promise<Outbound[]>`; `dispatchPending(): Promise<{ claimed: number; sent: number; failed: number; skipped: number }>`; `dispatchPending()` calls `linkTelegramCodes(admin)`; Task 3 ships a temporary no-op export, Task 4 replaces it.

- [ ] **Step 1: Write failing backoff and recipient tests**

In `backoff.test.ts`, assert `retryAt(1, base)` is `base + 60000`, `retryAt(2, base)` is `base + 300000`, `retryAt(3, base)` is `base + 1500000`, `retryAt(4, base)` is `null`.
In `recipient.test.ts`, pass a minimal fake admin client and assert: an `email` row yields one `Outbound` with the recipient unchanged; a `telegram` row yields one `Outbound` whose recipient is the profile's `telegram_chat_id` (and none when absent); a `push` row yields one `Outbound` per subscription with its `subscription` object; an unknown channel yields `[]`.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test src/server/notifications/backoff.test.ts src/server/notifications/recipient.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the pure helpers**

Implement `backoff.ts` exactly as tested. Implement `recipient.ts` as `resolveOutbound(row: Pick<NotificationOutboxRow, "channel" | "recipient" | "subject" | "body">, admin: SupabaseClient): Promise<Outbound[]>`, querying `profiles` by `id` for telegram and `web_push_subscriptions` by `user_id` for push. Document the `recipient` convention in a one-line comment: email → address, SMS → E.164, telegram/push → user id.

- [ ] **Step 4: Run the helper tests**

Run: `pnpm test src/server/notifications/backoff.test.ts src/server/notifications/recipient.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the worker**

In `dispatch.ts`, implement `dispatchPending()`: call `await linkTelegramCodes(admin)` (Task 4 supplies it; until then stub it as an empty exported function in `dispatch.ts` and delete the stub in Task 4), claim rows via `admin.rpc("claim_notification_batch", { p_limit: 50 })`, resolve each row with `resolveOutbound`, send each with `notifierFor`, and update the row: success → `status: "sent", sent_at: new Date().toISOString(), error: null, claimed_at: null`; failure → `attempts: row.attempts + 1`, `error`, `claimed_at: null`, and either `status: "pending", scheduled_for: retryAt(row.attempts + 1, new Date())` or `status: "failed"` when `retryAt` returns `null`. A row with no resolved recipients counts as `skipped` and is marked `failed` with `error: "no_recipient"`. Return the four counts.

Update the docblock in `src/lib/supabase/admin.ts` to include the notification worker and dispatch route in the allowed importers.

- [ ] **Step 6: Commit**

```bash
git add src/server/notifications src/lib/supabase/admin.ts
git commit -m "feat(notifications): claim-and-retry outbox worker"
```

### Task 4: Telegram self-link

**Files:**
- Create: `src/server/notifications/telegram-link.ts`, `src/server/notifications/telegram-link.test.ts`, `src/components/domain/telegram-link-card.tsx`
- Modify: `src/server/actions/settings.ts`, `messages/en.json`, `messages/ar.json`

**Interfaces:**
- Consumes: admin client from `src/lib/supabase/admin.ts`.
- Produces: `linkTelegramCodes(admin): Promise<number>`; `parseStartCode(text: string): string | null`; `generateTelegramLinkCodeAction`, `unlinkTelegramAction` with the `(_prev: SettingsState, formData: FormData) => Promise<SettingsState>` shape.

- [ ] **Step 1: Write the failing parser test**

In `telegram-link.test.ts`, assert `parseStartCode("/start 123456")` is `"123456"`, `parseStartCode("/start 123456@bot")` is `"123456"`, `parseStartCode("hello")` is `null`, and `parseStartCode("/start ")` is `null`.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test src/server/notifications/telegram-link.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement linking**

Implement `parseStartCode` with a regex for `/start <6 digits>` optionally followed by `@username`. Implement `linkTelegramCodes(admin)`: read `telegram_state.last_update_id`, call `https://api.telegram.org/bot{token}/getUpdates` with `offset` and a short timeout, skip on missing token or API error, for each message with a valid code update the matching `profiles` row where `telegram_link_code = code and telegram_link_expires_at > now()`, set `telegram_chat_id = String(message.chat.id)`, clear code and expiry, count links, and persist the highest `update_id + 1` back to `telegram_state`. Do not log chat IDs.

- [ ] **Step 4: Run the test**

Run: `pnpm test src/server/notifications/telegram-link.test.ts`
Expected: PASS.

- [ ] **Step 5: Add settings actions**

In `src/server/actions/settings.ts`, add `generateTelegramLinkCodeAction` (checks `settings.write`, generates six digits via `crypto.randomBytes`, stores code and `now() + 10 minutes` on `ctx.userId`'s profile, returns `{ ok: "code_generated" }`) and `unlinkTelegramAction` (clears `telegram_chat_id`, code and expiry, returns `{ ok: "unlinked" }`). Both `revalidatePath("/settings/notifications")`.

- [ ] **Step 6: Add the UI card and translations**

Create `src/components/domain/telegram-link-card.tsx`: a client component using `useActionState`, showing the bot username from `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, a "generate code" button, the returned code with `/start CODE` hint, linked state, and an unlink button. Add keys under `settings.notifications` to both message files: `telegramTitle`, `telegramSubtitle`, `generateCode`, `codeHint`, `linked`, `unlink`, `codeGenerated`, `unlinked`, and `channels.telegram`.

- [ ] **Step 7: Wire the card into settings and commit**

Add `<TelegramLinkCard />` to `src/app/[locale]/(app)/settings/notifications/page.tsx` above the template form. Run `pnpm lint && pnpm typecheck`. Then:

```bash
git add src/server/notifications src/server/actions/settings.ts src/components/domain/telegram-link-card.tsx messages/en.json messages/ar.json 'src/app/[locale]/(app)/settings/notifications/page.tsx'
git commit -m "feat(notifications): telegram self-link in settings"
```

### Task 5: Web push, dispatch route and settings page wiring

**Files:**
- Create: `public/sw.js`, `src/components/domain/web-push-card.tsx`, `src/components/domain/send-now-button.tsx`, `src/app/api/notifications/dispatch/route.ts`
- Modify: `src/server/actions/settings.ts`, `src/components/domain/notification-template-form.tsx`, `src/app/[locale]/(app)/settings/notifications/page.tsx`, `messages/en.json`, `messages/ar.json`

**Interfaces:**
- Consumes: `dispatchPending()` from Task 3, `Notifier`/`Outbound` from Task 2.
- Produces: `POST /api/notifications/dispatch`; `savePushSubscriptionAction`, `removePushSubscriptionAction`, `sendNotificationsNowAction` in `settings.ts`.

- [ ] **Step 1: Add push subscription actions**

In `src/server/actions/settings.ts`, add `savePushSubscriptionAction(_prev, formData)` and `removePushSubscriptionAction(_prev, formData)`, both checking `settings.write`. The save action parses a JSON `subscription` field with a Zod schema of `{ endpoint: string, keys: { p256dh: string, auth: string } }` and upserts into `web_push_subscriptions` with `ctx.orgId`, `ctx.userId` and `created_by`; the remove action deletes the row for `ctx.userId` and the submitted `endpoint`. Add `sendNotificationsNowAction(_prev, formData)` that checks `settings.write`, calls `dispatchPending()` and returns `{ ok: "dispatched" }`. All three `revalidatePath("/settings/notifications")`.

- [ ] **Step 2: Add the service worker and client cards**

Create `public/sw.js`: on `push`, parse the JSON payload and call `registration.showNotification(title, { body })`; on `notificationclick`, close the notification and focus `/dashboard`. Create `web-push-card.tsx`: register `/sw.js`, call `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: <VAPID public key from NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY> })`, post the subscription JSON through the save action, and expose unsubscribe. Create `send-now-button.tsx`: a client button using the send-now action and showing the returned state.

- [ ] **Step 3: Align the template channel selector**

In `src/components/domain/notification-template-form.tsx`, change the channel options to `["email", "sms", "telegram", "push"]`; in `src/server/actions/settings.ts`, change `templateSchema.channel` to `z.enum(["email", "sms", "telegram", "push"])`. Replace the `web_push` translation key with `push` in both message files and add `settings.notifications.pushTitle`, `pushSubtitle`, `enablePush`, `disablePush`, `sendNow`, `sendNowHint`, `errors.no_recipient`.

- [ ] **Step 4: Add the dispatch route**

Create `src/app/api/notifications/dispatch/route.ts` exporting `POST`. Compare the `Authorization` header to `Bearer ${process.env.NOTIFICATION_CRON_SECRET}`; return `Response.json({ error: "unauthorized" }, { status: 401 })` on mismatch or when the secret is unset. Otherwise `return Response.json(await dispatchPending())`. No other HTTP methods are exported.

- [ ] **Step 5: Wire everything into settings and verify**

Add `<WebPushCard />` and `<SendNowButton />` to the notifications page. Run `pnpm lint && pnpm typecheck && pnpm test`. Start the dev server and probe: `curl -X POST http://localhost:3000/api/notifications/dispatch` → 401; with a valid `Authorization` header and `NOTIFICATION_DRY_RUN=1` → JSON counts and pending rows moved to `sent` on the local DB.

- [ ] **Step 6: Commit**

```bash
git add public/sw.js src/components/domain src/app/api src/server/actions/settings.ts 'src/app/[locale]/(app)/settings/notifications/page.tsx' messages/en.json messages/ar.json
git commit -m "feat(notifications): web push, dispatch route and settings controls"
```

### Task 6: Environment template and final gates

**Files:**
- Modify: `.env.example`, `docs/runbook.md`

**Interfaces:**
- Consumes: all earlier tasks.
- Produces: no new symbols.

- [ ] **Step 1: Document configuration**

Add to `.env.example`: `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, `WEB_PUSH_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`, `NOTIFICATION_CRON_SECRET`, `NOTIFICATION_DRY_RUN`. Include the `npx web-push generate-vapid-keys` comment.

- [ ] **Step 2: Document the cron contract**

In `docs/runbook.md`, replace the D-017 "no sender" gap with a short section: `POST /api/notifications/dispatch` with `Authorization: Bearer $NOTIFICATION_CRON_SECRET`, recommended every minute, `NOTIFICATION_DRY_RUN=1` for local testing, and note that the cron caller is supplied by the owner.

- [ ] **Step 3: Run final gates and commit**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: all pass. Then:

```bash
git add .env.example docs/runbook.md
git commit -m "docs(notifications): configure delivery and cron contract"
```
