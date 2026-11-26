# Notification Event Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enqueue a notification for every business event the product promises (payment received, rent overdue, maintenance requested/changed, lease and document expiry), rendered from organization templates with a localized fallback, using the delivery core already shipped in 1A.

**Architecture:** One migration adds a dedupe key to `notification_outbox`, two security-definer helpers (`render_notification`, `enqueue_notification`), four `after` triggers for row events, an extracted `sweep_overdue(p_org)` called by both the existing manual RPC and a new reminder scan, and `enqueue_notification_reminders()` invoked by `dispatchPending()` before it claims the batch. The only TypeScript change is that one RPC call plus its test.

**Tech Stack:** Postgres 15 / Supabase migrations, pgTAP, TypeScript strict, Vitest, Next.js server code.

**Spec:** `docs/superpowers/specs/2026-11-18-notification-event-coverage-design.md`

## Global Constraints

- Money: integer minor units + currency code. Only `QAR AED SAR KWD BHD OMR` are supported; KWD/BHD/OMR have **3** decimals, the rest 2. Never use floats for money and never show minor units to a user.
- All new SQL functions are `security definer set search_path = public`. `enqueue_notification` and `sweep_overdue` are revoked from `public` and granted to nobody; `enqueue_notification_reminders` is granted to `service_role` only.
- Never edit an applied migration. All work in this plan goes into the single new file `supabase/migrations/20261118000048_notification_events.sql`.
- Email is the only channel enqueued in this plan.
- No new dependency, no scheduler, no pg_cron, no Edge Function, no remote DB command.
- Do not touch `package.json`, `pnpm-lock.yaml`, `src/server/actions/forecast.ts`, `src/app/[locale]/(app)/reports/cash-flow-forecast/`, `supabase/functions/`, `src/components/ui/date-picker.tsx` or `src/lib/i18n-keys.test.ts`.
- Verification commands in this worktree: `pnpm test <path>` works; for typecheck run `/Users/shahbaz/Desktop/gulf/node_modules/.bin/tsc --noEmit` (the worktree's tracked `node_modules` is incomplete). Two pre-existing errors from concurrent work (`src/components/ui/date-picker.tsx:58`, `src/lib/i18n-keys.test.ts:28,64`) are expected and are not yours to fix.
- Never run `git add -A` or `git commit -a` in this worktree: 5,650 `node_modules` files are tracked. Stage explicit paths only.

## Review Focus

These are the failure modes the spec implies but no task's happy path exercises. Each has a pinning test in the owning task.

1. A tenant with no email on file: payment/overdue/status-change must skip cleanly and must never make the payment or maintenance RPC fail.
2. Fan-out to several staff: every staff member gets their own row; one address must not suppress the others.
3. KWD/BHD/OMR amounts in a notification body must show 3 decimals, not 2 (a `/100` assumption is wrong by 10×).
4. A failing reminder scan must surface as a dispatch error, not be swallowed while the batch still sends.
5. Re-running the sweep or the reminder scan must add no duplicate rows, and a maintenance status regression must not re-notify.

---

### Task 1: Dedupe key, renderer and enqueue helper

**Files:**
- Create: `supabase/migrations/20261118000048_notification_events.sql`
- Create: `supabase/tests/notification_events_test.sql`

**Interfaces:**
- Consumes: existing `public.notification_templates(org_id, event, channel, locale, subject, body)`, unique on `(org_id, event, channel, locale)`; existing `public.notification_outbox`.
- Produces: `public.render_notification(p_org uuid, p_event text, p_channel text, p_locale text, p_payload jsonb) returns table(subject text, body text)` and `public.enqueue_notification(p_org uuid, p_event text, p_channel text, p_recipient text, p_locale text, p_payload jsonb, p_dedupe_key text) returns void`. Every later task calls these exact signatures.

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/notification_events_test.sql`. Start with no fixed plan count so later tasks can append without renumbering:

```sql
-- pgTAP: notification event coverage (payment, overdue, maintenance, reminders).
-- Run with `pnpm db:test`. Requires migrations 0001..20261118000048 applied.
begin;
create extension if not exists pgtap;
select no_plan();

-- fixture org/user/tenant used by several assertions
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'billing@test.dev');
insert into public.organizations (id, name, slug, settings) values
  ('33333333-3333-3333-3333-333333333333', 'Notify Org', 'notify-org',
   '{"late_fee_minor": 5000}'::jsonb);
insert into public.tenants (id, org_id, full_name, email, language) values
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
   'Notify Tenant', 'tenant@test.dev', 'ar');
insert into public.owners (id, org_id, name, is_company_self) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'Self Owner', true);
insert into public.buildings (id, org_id, owner_id, code, name, country_code) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B1', 'Notify Building', 'QA');
insert into public.floors (id, org_id, building_id, level) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-3333-3333-3333-333333333333',
   'cccccccc-cccc-cccc-cccc-cccccccccccc', 1);
insert into public.units (id, org_id, building_id, floor_id, unit_no) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-3333-3333-3333-333333333333',
   'cccccccc-cccc-cccc-cccc-cccccccccccc', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '101');

-- renderer: template wins over the built-in default
insert into public.notification_templates (org_id, event, channel, locale, subject, body) values
  ('33333333-3333-3333-3333-333333333333', 'payment_received', 'email', 'ar',
   'قالب مخصص', 'استلمنا {{amount}}');
select is(
  (select subject from public.render_notification(
     '33333333-3333-3333-3333-333333333333', 'payment_received', 'email', 'ar',
     '{"amount": "QAR 1,500.00"}'::jsonb)),
  'قالب مخصص', 'org template is used and tokens are interpolated'
);
select is(
  (select body from public.render_notification(
     '33333333-3333-3333-3333-333333333333', 'payment_received', 'email', 'ar',
     '{"amount": "QAR 1,500.00"}'::jsonb)),
  'استلمنا QAR 1,500.00', 'body tokens are interpolated'
);

-- renderer: no template for 'en' falls back to the built-in English default
select is(
  (select subject from public.render_notification(
     '33333333-3333-3333-3333-333333333333', 'payment_received', 'email', 'en', '{}'::jsonb)),
  'Payment received', 'built-in English default is used when no template exists'
);

-- renderer: unknown event still returns something non-empty
select isnt(
  (select body from public.render_notification(
     '33333333-3333-3333-3333-333333333333', 'something_new', 'email', 'en',
     '{"title": "Heads up"}'::jsonb)),
  '', 'unknown event falls back to payload title'
);

-- enqueue: blank recipient is skipped
select public.enqueue_notification(
  '33333333-3333-3333-3333-333333333333', 'payment_received', 'email', null, 'ar', '{}'::jsonb, 'k1');
select is(
  (select count(*) from public.notification_outbox
    where org_id = '33333333-3333-3333-3333-333333333333'),
  0::bigint, 'blank recipient inserts nothing'
);

-- enqueue: same key and recipient twice -> one row
select public.enqueue_notification(
  '33333333-3333-3333-3333-333333333333', 'payment_received', 'email', 'a@test.dev', 'en', '{}'::jsonb, 'k2');
select public.enqueue_notification(
  '33333333-3333-3333-3333-333333333333', 'payment_received', 'email', 'a@test.dev', 'en', '{}'::jsonb, 'k2');
select is(
  (select count(*) from public.notification_outbox
    where org_id = '33333333-3333-3333-3333-333333333333' and dedupe_key = 'k2'),
  1::bigint, 'duplicate key + recipient is deduped'
);

-- enqueue: same key, different recipient -> both rows survive the fan-out
select public.enqueue_notification(
  '33333333-3333-3333-3333-333333333333', 'payment_received', 'email', 'b@test.dev', 'en', '{}'::jsonb, 'k2');
select is(
  (select count(*) from public.notification_outbox
    where org_id = '33333333-3333-3333-3333-333333333333' and dedupe_key = 'k2'),
  2::bigint, 'same key with a different recipient is kept'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Confirm it fails against the current schema**

Run: `supabase test db` is owner-gated and unavailable here, so inspect instead: `grep -c "dedupe_key" supabase/migrations/*.sql` returns 0 for migration `0001..00046` and the new migration does not exist yet. Expected: the test file references functions that do not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261118000048_notification_events.sql`:

```sql
-- 0048: notification event coverage. Enqueue helpers + row-event triggers + reminder scan.

alter table public.notification_outbox add column dedupe_key text;
create unique index notification_outbox_dedupe_idx
  on public.notification_outbox (org_id, event, dedupe_key, recipient)
  where dedupe_key is not null;

-- Display formatting only; the ledger value is never converted. The exponent is the one
-- the currencies table (and `src/lib/money.ts`) already uses, so KWD/BHD/OMR stay 3-digit.
create or replace function public.format_money(p_minor bigint, p_currency text) returns text
language sql stable security definer set search_path = public as $$
  select to_char(
    p_minor / power(10, coalesce((select exponent from public.currencies where code = p_currency), 2)),
    case when coalesce((select exponent from public.currencies where code = p_currency), 2) = 3
      then 'FM999,999,999,990.000' else 'FM999,999,999,990.00' end
  ) || ' ' || p_currency
$$;
```

Then `render_notification` with this exact resolution order:

1. Template row for `(p_org, p_event, p_channel, coalesce(p_locale, 'en'))`.
2. Template row for `(p_org, p_event, p_channel, 'en')`.
3. Built-in default for `(p_event, p_locale = 'ar')` — implement as a `case p_event` returning subject/body, with the Arabic branch selected by `p_locale = 'ar'`.
4. Otherwise `subject = p_event`, `body = coalesce(p_payload->>'title', p_event)`.

After the subject/body is chosen, loop `for v_key, v_value in select * from jsonb_each_text(coalesce(p_payload, '{}'::jsonb))` and `replace()` every `{{v_key}}` in both strings.

Built-in defaults (verbatim copy):

| event | en subject / body | ar subject / body |
|---|---|---|
| `payment_received` | `Payment received` / `We received {{amount}} for {{tenant_name}}. Receipt {{receipt_no}}.` | `تم استلام الدفعة` / `استلمنا {{amount}} من {{tenant_name}}. إيصال رقم {{receipt_no}}.` |
| `rent_overdue` | `Rent overdue` / `Charge {{amount}} on lease {{lease_no}} was due {{due_date}} and is now overdue.` | `إيجار متأخر` / `المبلغ {{amount}} للعقد {{lease_no}} كان مستحقاً في {{due_date}} وأصبح متأخراً.` |
| `lease_expiring` | `Lease expiring` / `Lease {{lease_no}} ends on {{end_date}}.` | `انتهاء عقد الإيجار` / `ينتهي العقد {{lease_no}} في {{end_date}}.` |
| `maintenance_requested` | `New maintenance request` / `{{title}} (unit {{unit_no}}).` | `طلب صيانة جديد` / `{{title}} (الوحدة {{unit_no}}).` |
| `maintenance_status_changed` | `Maintenance update` / `{{title}} is now {{status}}.` | `تحديث الصيانة` / `{{title}} أصبح الآن {{status}}.` |
| `document_expiring` | `Document expiring` / `Document {{kind}} expires on {{expires_on}}.` | `انتهاء صلاحية مستند` / `تنتهي صلاحية المستند {{kind}} في {{expires_on}}.` |

Then `enqueue_notification`:

```sql
create or replace function public.enqueue_notification(
  p_org uuid, p_event text, p_channel text, p_recipient text,
  p_locale text, p_payload jsonb, p_dedupe_key text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_subject text; v_body text;
begin
  if p_recipient is null or btrim(p_recipient) = '' then return; end if;
  select r.subject, r.body into v_subject, v_body
  from public.render_notification(p_org, p_event, p_channel, p_locale, p_payload) r;
  insert into public.notification_outbox
    (org_id, event, channel, recipient, locale, subject, body, payload, status, scheduled_for, dedupe_key)
  values
    (p_org, p_event, p_channel, p_recipient, coalesce(p_locale, 'en'), v_subject, v_body,
     coalesce(p_payload, '{}'::jsonb), 'pending', now(), p_dedupe_key)
  on conflict (org_id, event, dedupe_key, recipient) where dedupe_key is not null do nothing;
end;
$$;

revoke all on function public.enqueue_notification(uuid, text, text, text, text, jsonb, text) from public;
revoke all on function public.render_notification(uuid, text, text, text, jsonb) from public;
```

- [ ] **Step 4: Add the pgTAP assertions for `format_money`**

Append before `select * from finish();`:

```sql
select is(public.format_money(150000, 'QAR'), '1,500.00 QAR', 'QAR uses 2 decimals');
select is(public.format_money(1500, 'KWD'), '1.500 KWD', 'KWD uses 3 decimals');
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261118000048_notification_events.sql supabase/tests/notification_events_test.sql
git commit -m "feat(notifications): enqueue helpers with template fallback and dedupe"
```

---

### Task 2: Row-event triggers

**Files:**
- Modify: `supabase/migrations/20261118000048_notification_events.sql`
- Modify: `supabase/tests/notification_events_test.sql`

**Interfaces:**
- Consumes: `public.enqueue_notification(...)` and `public.format_money(...)` from Task 1.
- Produces: triggers `payments_notify_received`, `charges_notify_overdue`, `maintenance_notify_created`, `maintenance_notify_status` and their trigger functions. Task 3's sweep relies on `charges_notify_overdue` firing when it flips a status to `overdue`.

- [ ] **Step 1: Write the failing pgTAP assertions**

Append before `select * from finish();`:

```sql
-- payments: insert enqueues one row, formatted with the currency exponent
insert into public.leases (id, org_id, unit_id, tenant_id, lease_no, start_date, end_date, status, rent_minor, currency, payment_frequency)
values ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '44444444-4444-4444-4444-444444444444', 'L-1',
        current_date - 30, current_date + 335, 'active', 150000, 'QAR', 'monthly');

insert into public.payments (org_id, tenant_id, lease_id, receipt_no, receipt_year, amount_minor, currency, method, received_at)
values ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444',
        '55555555-5555-5555-5555-555555555555', 7, 2026, 150000, 'QAR', 'cash', now());

select is(
  (select count(*) from public.notification_outbox
    where org_id = '33333333-3333-3333-3333-333333333333' and event = 'payment_received'),
  1::bigint, 'payment insert enqueues exactly one row'
);
select ok(
  (select body like '%1,500.00 QAR%' from public.notification_outbox
    where org_id = '33333333-3333-3333-3333-333333333333' and event = 'payment_received'),
  'payment body formats the amount and uses the tenant locale'
);
select is(
  (select locale from public.notification_outbox
    where org_id = '33333333-3333-3333-3333-333333333333' and event = 'payment_received'),
  'ar', 'payment uses tenants.language'
);

-- tenant without an email: no row, and the insert still succeeds
insert into public.tenants (id, org_id, full_name, language) values
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 'No Mail', 'en');
insert into public.payments (org_id, tenant_id, receipt_no, receipt_year, amount_minor, currency, method, received_at)
values ('33333333-3333-3333-3333-333333333333', '66666666-6666-6666-6666-666666666666',
        8, 2026, 1000, 'KWD', 'cash', now());
select is(
  (select count(*) from public.notification_outbox
    where org_id = '33333333-3333-3333-3333-333333333333' and event = 'payment_received'),
  1::bigint, 'tenant without email is skipped and the payment still lands'
);

-- charge: transition to overdue enqueues once, repeat transition does not
insert into public.charges (id, org_id, lease_id, type, description, period_start, due_date, amount_minor, currency, status)
values ('77777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333',
        '55555555-5555-5555-5555-555555555555', 'rent', 'Rent', current_date - 40, current_date - 10, 150000, 'QAR', 'pending');
update public.charges set status = 'overdue' where id = '77777777-7777-7777-7777-777777777777';
update public.charges set status = 'overdue' where id = '77777777-7777-7777-7777-777777777777';
select is(
  (select count(*) from public.notification_outbox
    where org_id = '33333333-3333-3333-3333-333333333333' and event = 'rent_overdue'),
  1::bigint, 'overdue transition enqueues once per charge'
);

-- maintenance: created notifies every staff member once, per recipient
insert into public.org_members (org_id, user_id, role) values
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-0000000000f1', 'org_admin');
insert into public.maintenance_requests (id, org_id, building_id, tenant_id, title, status)
values ('88888888-8888-8888-8888-888888888888', '33333333-3333-3333-3333-333333333333',
        'cccccccc-cccc-cccc-cccc-cccccccccccc', '44444444-4444-4444-4444-444444444444', 'Leaky tap', 'open');
select is(
  (select count(*) from public.notification_outbox
    where org_id = '33333333-3333-3333-3333-333333333333' and event = 'maintenance_requested'),
  (select count(*) from public.org_members
    where org_id = '33333333-3333-3333-3333-333333333333' and role in ('org_admin','manager','caretaker')),
  'one maintenance row per staff recipient'
);

-- maintenance status change notifies the tenant once
update public.maintenance_requests set status = 'in_progress' where id = '88888888-8888-8888-8888-888888888888';
select is(
  (select count(*) from public.notification_outbox
    where org_id = '33333333-3333-3333-3333-333333333333' and event = 'maintenance_status_changed'),
  1::bigint, 'status change enqueues one tenant row'
);
```

- [ ] **Step 2: Confirm the assertions fail**

Run: `grep -c "payments_notify_received" supabase/migrations/20261118000048_notification_events.sql`. Expected: `0` (no triggers yet), so the new assertions have nothing to observe.

- [ ] **Step 3: Add the trigger functions and triggers**

Append to the migration. All functions are `security definer set search_path = public` and only ever call `enqueue_notification`.

- `payments_notify_received()` — `after insert on public.payments for each row`:
  join `public.tenants t on t.id = new.tenant_id`; recipient `t.email`, locale `coalesce(t.language, 'en')`; payload `jsonb_build_object('receipt_no', new.receipt_year::text || '-' || lpad(new.receipt_no::text, 4, '0'), 'amount', public.format_money(new.amount_minor, new.currency), 'tenant_name', t.full_name)`; event `payment_received`, channel `email`, key `'payment:' || new.id`.
- `charges_notify_overdue()` — `after update of status on public.charges for each row when (new.status = 'overdue' and new.status is distinct from old.status)`:
  `select t.email, t.language, l.lease_no into ... from public.leases l join public.tenants t on t.id = l.tenant_id where l.id = new.lease_id`; payload `amount`, `due_date` (`to_char(new.due_date, 'YYYY-MM-DD')`), `lease_no`; key `'charge-overdue:' || new.id`.
- `maintenance_notify_created()` — `after insert on public.maintenance_requests for each row`:
  loop `select u.email, coalesce(p.locale, 'en') as locale from public.org_members m join auth.users u on u.id = m.user_id left join public.profiles p on p.id = m.user_id where m.org_id = new.org_id and m.role in ('org_admin','manager','caretaker') and u.email is not null`; payload `title` = `new.title`, `unit_no` = `coalesce((select unit_no from public.units where id = new.unit_id), '')`, `status` = `new.status::text`; key `'maintenance-requested:' || new.id`.
- `maintenance_notify_status()` — `after update of status on public.maintenance_requests for each row when (new.status is distinct from old.status)`:
  when `new.tenant_id is not null`, `select t.email, t.language into ... from public.tenants t where t.id = new.tenant_id`; payload `title`, `status` = `new.status::text`, `unit_no` as above; key `'maintenance-status:' || new.id || ':' || new.status::text`.

Create the four triggers with `create trigger ..._notify_... after insert|update ... on ... for each row execute function ...`.

- [ ] **Step 4: Check the assertions' SQL is consistent with the triggers**

Re-read the appended test block against the trigger definitions: event names, key prefixes and token names must match exactly (`payment_received`, `rent_overdue` vs `charge-overdue` prefix, `maintenance_status_changed`). Fix the test or trigger names until they agree; the pgTAP suite is the only place these are pinned.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261118000048_notification_events.sql supabase/tests/notification_events_test.sql
git commit -m "feat(notifications): enqueue payment, overdue and maintenance events"
```

---

### Task 3: Extract the overdue sweep so it can run without a user

**Files:**
- Modify: `supabase/migrations/20261118000048_notification_events.sql`
- Modify: `supabase/tests/notification_events_test.sql`

**Interfaces:**
- Consumes: `charges_notify_overdue` from Task 2 (fires as rows flip to overdue).
- Produces: `public.sweep_overdue(p_org uuid default null) returns integer`; `public.mark_overdue_and_late_fees()` keeps its exact signature and return type.

- [ ] **Step 1: Write the failing pgTAP assertions**

Append before `select * from finish();`:

```sql
-- a future-due charge is untouched, and a fresh past-due charge is what the sweep marks
insert into public.charges (id, org_id, lease_id, type, description, period_start, due_date, amount_minor, currency, status)
values
  ('99999999-9999-4999-8999-999999999999', '33333333-3333-3333-3333-333333333333',
   '55555555-5555-5555-5555-555555555555', 'rent', 'Future rent', current_date, current_date + 10, 90000, 'QAR', 'pending'),
  ('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '33333333-3333-3333-3333-333333333333',
   '55555555-5555-5555-5555-555555555555', 'rent', 'Late rent', current_date - 5, current_date - 5, 90000, 'QAR', 'pending');
select is(public.sweep_overdue('33333333-3333-3333-3333-333333333333'), 1,
  'the sweep marks only past-due charges');
select is(
  (select status from public.charges where id = 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  'overdue'::public.charge_status, 'past-due charge is overdue after the sweep'
);
select is(
  (select status from public.charges where id = '99999999-9999-4999-8999-999999999999'),
  'pending'::public.charge_status, 'future-due charge is untouched'
);

-- all-orgs form marks nothing new and adds no duplicate late fees
select is(public.sweep_overdue(null), 0, 're-running the sweep marks nothing new');
select is(
  (select count(*) from public.charges
    where lease_id = '55555555-5555-5555-5555-555555555555' and type = 'late_fee'),
  3::bigint, 'one late fee per overdue charge after two sweeps'
);
```

The count is 3, not 2: Task 2's interpolation fixture adds a third past-due charge (due
`current_date - 20`) alongside `current_date - 10` and Task 3's fresh `current_date - 5`.

- [ ] **Step 2: Confirm the assertions fail**

Run: `grep -n "sweep_overdue" supabase/migrations/20261118000048_notification_events.sql`. Expected: no match.

- [ ] **Step 3: Add `sweep_overdue`**

Append `public.sweep_overdue(p_org uuid default null) returns integer` copying the body of `mark_overdue_and_late_fees` (`supabase/migrations/20261116000024_business_rules.sql:120-176`) with these changes only:

- No `auth_org()` / `auth_role()` usage.
- Marking update joins settings per org instead of reading one:
  `update public.charges c set status = 'overdue' from public.organizations o where o.id = c.org_id and (p_org is null or c.org_id = p_org) and c.status in ('pending','partial') and c.due_date + coalesce((o.settings->>'grace_days')::int, 0) < current_date returning c.id`.
- The late-fee loop selects `c.org_id`, `coalesce((o.settings->>'late_fee_minor')::bigint, 0) as fee_minor`, `coalesce((o.settings->>'late_fee_percent')::numeric, 0) as fee_pct` from `public.charges c join public.organizations o on o.id = c.org_id`, with the same `(p_org is null or c.org_id = p_org)` and grace filter, and inserts the fee only when `fee_minor > 0 or fee_pct > 0`.
- Returns the count of newly marked charges, exactly like today.

Then redefine the wrapper:

```sql
create or replace function public.mark_overdue_and_late_fees() returns integer
language plpgsql security definer set search_path = public as $$
begin
  if auth_role() not in ('org_admin', 'accountant') then
    raise exception 'Insufficient role to run the overdue sweep.' using errcode = '42501';
  end if;
  return public.sweep_overdue(auth_org());
end;
$$;

revoke all on function public.mark_overdue_and_late_fees() from public;
grant execute on function public.mark_overdue_and_late_fees() to authenticated;
revoke all on function public.sweep_overdue(uuid) from public;
```

- [ ] **Step 4: Verify the wrapper still matches its caller**

Run: `grep -rn "mark_overdue_and_late_fees" src/ | head`. Expected: only `src/server/actions/settings.ts` calls it, with no arguments. Any call-site change means the signature was altered by mistake.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261118000048_notification_events.sql supabase/tests/notification_events_test.sql
git commit -m "refactor(notifications): extract all-org overdue sweep"
```

---

### Task 4: Reminder scan (lease and document expiry)

**Files:**
- Modify: `supabase/migrations/20261118000048_notification_events.sql`
- Modify: `supabase/tests/notification_events_test.sql`

**Interfaces:**
- Consumes: `sweep_overdue(null)` (Task 3), `enqueue_notification(...)` (Task 1).
- Produces: `public.enqueue_notification_reminders() returns void`, granted to `service_role`; Task 5 calls it over PostgREST.

- [ ] **Step 1: Write the failing pgTAP assertions**

Append before `select * from finish();`:

```sql
-- lease ending inside the org reminder window notifies each staff member once
update public.organizations
   set settings = settings || '{"reminder_days": 30}'::jsonb
 where id = '33333333-3333-3333-3333-333333333333';
update public.leases set end_date = current_date + 10
 where id = '55555555-5555-5555-5555-555555555555';

select public.enqueue_notification_reminders();
select public.enqueue_notification_reminders();

select is(
  (select count(*) from public.notification_outbox
    where org_id = '33333333-3333-3333-3333-333333333333' and event = 'lease_expiring'),
  (select count(*) from public.org_members
    where org_id = '33333333-3333-3333-3333-333333333333' and role in ('org_admin','manager')),
  'lease reminder: one row per staff recipient after two scans'
);

-- document expiring inside 30 days, scanned twice -> one row per staff recipient
insert into public.documents (id, org_id, entity_type, entity_id, kind, path, expires_on) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333',
   'lease', '55555555-5555-5555-5555-555555555555', 'contract',
   '33333333-3333-3333-3333-333333333333/contracts/t.pdf', current_date + 5);
select public.enqueue_notification_reminders();
select is(
  (select count(*) from public.notification_outbox
    where org_id = '33333333-3333-3333-3333-333333333333' and event = 'document_expiring'),
  (select count(*) from public.org_members
    where org_id = '33333333-3333-3333-3333-333333333333' and role in ('org_admin','manager','caretaker')),
  'document reminder is idempotent and fans out per recipient'
);
```

- [ ] **Step 2: Confirm the assertions fail**

Run: `grep -n "enqueue_notification_reminders" supabase/migrations/20261118000048_notification_events.sql`. Expected: no match.

- [ ] **Step 3: Add the scan**

Append `public.enqueue_notification_reminders() returns void`, `language plpgsql security definer set search_path = public`:

1. `perform public.sweep_overdue(null);`
2. Lease loop: for each row of
   `select l.id, l.org_id, l.lease_no, l.end_date from public.leases l join public.organizations o on o.id = l.org_id where l.status = 'active' and l.end_date between current_date and current_date + coalesce((o.settings->>'reminder_days')::int, 30)`,
   loop over staff `select u.email, coalesce(p.locale, 'en') as locale from public.org_members m join auth.users u on u.id = m.user_id left join public.profiles p on p.id = m.user_id where m.org_id = l.org_id and m.role in ('org_admin','manager') and u.email is not null`
   and call `enqueue_notification(l.org_id, 'lease_expiring', 'email', staff.email, staff.locale, jsonb_build_object('lease_no', l.lease_no, 'end_date', to_char(l.end_date, 'YYYY-MM-DD')), 'lease-expiring:' || l.id || ':' || l.end_date)`.
3. Document loop: for each row of
   `select d.id, d.org_id, d.kind, d.expires_on from public.documents d where d.expires_on between current_date and current_date + 30`,
   loop over staff roles `('org_admin','manager','caretaker')` with the same `profiles.locale` join and call
   `enqueue_notification(d.org_id, 'document_expiring', 'email', staff.email, staff.locale, jsonb_build_object('kind', d.kind, 'expires_on', to_char(d.expires_on, 'YYYY-MM-DD')), 'document-expiring:' || d.id || ':' || d.expires_on)`.
4. `grant execute on function public.enqueue_notification_reminders() to service_role;` and `revoke all on function public.enqueue_notification_reminders() from public;`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261118000048_notification_events.sql supabase/tests/notification_events_test.sql
git commit -m "feat(notifications): lease and document expiry reminder scan"
```

---

### Task 5: Run the scan inside the dispatch tick

**Files:**
- Modify: `src/server/notifications/dispatch.ts:18-19`
- Create: `src/server/notifications/dispatch.test.ts`

**Interfaces:**
- Consumes: `admin.rpc("enqueue_notification_reminders")` from Task 4.
- Produces: nothing new; `dispatchPending()` keeps its exported signature and `DispatchCounts` shape.

- [ ] **Step 1: Write the failing test**

Create `src/server/notifications/dispatch.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { calls, rpc } = vi.hoisted(() => ({ calls: [] as string[], rpc: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: async (name: string, params?: Record<string, unknown>) => {
      calls.push(name);
      return rpc(name, params);
    },
    from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
  }),
}));
vi.mock("./telegram-link", () => ({
  linkTelegramCodes: async () => {
    calls.push("link");
    return 0;
  },
}));

import { dispatchPending } from "./dispatch";

describe("dispatchPending", () => {
  beforeEach(() => {
    calls.length = 0;
    rpc.mockReset();
  });

  it("runs the reminder scan before claiming the batch", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "enqueue_notification_reminders") return { data: null, error: null };
      return { data: [], error: null };
    });

    await dispatchPending();

    expect(calls).toEqual(["link", "enqueue_notification_reminders", "claim_notification_batch"]);
  });

  it("throws and does not claim when the reminder scan fails", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "enqueue_notification_reminders") return { data: null, error: new Error("scan failed") };
      return { data: [], error: null };
    });

    await expect(dispatchPending()).rejects.toThrow("scan failed");
    expect(calls).toEqual(["link", "enqueue_notification_reminders"]);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test src/server/notifications/dispatch.test.ts`
Expected: FAIL — `calls` is `["link", "claim_notification_batch"]` in test 1 and the first test's expectation mismatches.

- [ ] **Step 3: Call the scan between linking and claiming**

In `src/server/notifications/dispatch.ts`, after `await linkTelegramCodes(admin);`:

```ts
const { error: scanError } = await admin.rpc("enqueue_notification_reminders");
if (scanError) throw scanError;
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm test src/server/notifications/dispatch.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/notifications/dispatch.ts src/server/notifications/dispatch.test.ts
git commit -m "feat(notifications): run the expiry scan before each dispatch tick"
```

---

### Task 6: Types, runbook, and branch verification

**Files:**
- Modify: `src/types/database.ts` (`notification_outbox` Row/Insert/Update only)
- Modify: `docs/runbook.md`

**Interfaces:**
- Consumes: everything above.
- Produces: no new code.

- [ ] **Step 1: Add `dedupe_key` to the generated types**

In `src/types/database.ts`, inside the `notification_outbox` entry only: add `dedupe_key: string | null` to `Row`, and `dedupe_key?: string | null` to `Insert` and `Update`. Do not regenerate the whole file — `supabase gen types --linked` is owner-gated, and the file has hand-maintained entries elsewhere.

- [ ] **Step 2: Verify the TypeScript surface**

Run: `/Users/shahbaz/Desktop/gulf/node_modules/.bin/tsc --noEmit`
Expected: only the two pre-existing errors (`date-picker.tsx:58`, `i18n-keys.test.ts:28,64`). Any error mentioning `dedupe_key` means the Row/Insert/Update shapes disagree.

- [ ] **Step 3: Extend the runbook**

In `docs/runbook.md`, under the notification dispatch section, add:

- The events enqueued now: `cheque_bounced`, `payment_received`, `rent_overdue`, `maintenance_requested`, `maintenance_status_changed`, `lease_expiring`, `document_expiring`.
- That the tick runs `enqueue_notification_reminders` (which sweeps overdue charges for every org) before claiming, so one external cron still covers everything, and a scan failure aborts that tick.
- Pre-deploy SQL probes, next to the existing 1A ones: run the two pgTAP commands — `supabase test db` locally or `pnpm db:test --linked` — and confirm `supabase/tests/notification_events_test.sql` passes; then in staging run `select public.enqueue_notification_reminders();` twice and confirm the `lease_expiring`/`document_expiring` row counts are unchanged.

- [ ] **Step 4: Run the full set of gates**

```bash
pnpm lint
/Users/shahbaz/Desktop/gulf/node_modules/.bin/tsc --noEmit
pnpm test src/server/notifications/
```

Expected: lint clean for the touched files; typecheck shows only the two known concurrent-session errors; every notification test passes, including the 2 new dispatch tests.

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts docs/runbook.md
git commit -m "docs(notifications): event coverage types and pre-deploy checks"
```
