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

select is(public.format_money(150000, 'QAR'), '1,500.00 QAR', 'QAR uses 2 decimals');
select is(public.format_money(1500, 'KWD'), '1.500 KWD', 'KWD uses 3 decimals');

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
    where org_id = '33333333-3333-3333-3333-333333333333' and event = 'payment_received' and dedupe_key like 'payment:%'),
  1::bigint, 'payment insert enqueues exactly one row'
);
select ok(
  (select body like '%1,500.00 QAR%' from public.notification_outbox
    where org_id = '33333333-3333-3333-3333-333333333333' and event = 'payment_received' and dedupe_key like 'payment:%'),
  'payment body formats the amount and uses the tenant locale'
);
select is(
  (select locale from public.notification_outbox
    where org_id = '33333333-3333-3333-3333-333333333333' and event = 'payment_received' and dedupe_key like 'payment:%'),
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
    where org_id = '33333333-3333-3333-3333-333333333333' and event = 'payment_received' and dedupe_key like 'payment:%'),
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

-- FIX-ROUND-1: pin the payload token names for all four events. `?&` fails if any
-- token is misspelled; bool_and keeps the subquery scalar for fan-out events and
-- coalesce makes a missing row a failure.
select ok(
  (select coalesce(bool_and(payload ?& array['receipt_no', 'amount', 'tenant_name']), false)
   from public.notification_outbox
   where org_id = '33333333-3333-3333-3333-333333333333'
     and event = 'payment_received' and dedupe_key like 'payment:%'),
  'payment_received payload has receipt_no, amount, tenant_name'
);
select ok(
  (select coalesce(bool_and(payload ?& array['amount', 'due_date', 'lease_no']), false)
   from public.notification_outbox
   where org_id = '33333333-3333-3333-3333-333333333333'
     and event = 'rent_overdue' and dedupe_key like 'charge-overdue:%'),
  'rent_overdue payload has amount, due_date, lease_no'
);
select ok(
  (select coalesce(bool_and(payload ?& array['title', 'unit_no', 'status']), false)
   from public.notification_outbox
   where org_id = '33333333-3333-3333-3333-333333333333'
     and event = 'maintenance_requested' and dedupe_key like 'maintenance-requested:%'),
  'maintenance_requested payload has title, unit_no, status'
);
select ok(
  (select coalesce(bool_and(payload ?& array['title', 'unit_no', 'status']), false)
   from public.notification_outbox
   where org_id = '33333333-3333-3333-3333-333333333333'
     and event = 'maintenance_status_changed' and dedupe_key like 'maintenance-status:%'),
  'maintenance_status_changed payload has title, unit_no, status'
);

-- FIX-ROUND-1: real interpolation of a three-token event. Org 'en' template is reached
-- via the renderer's locale fallback (tenant language is 'ar'); a fresh charge id gives
-- a fresh dedupe key, and the existing lease keeps the fixture isolated from Task 3.
insert into public.notification_templates (org_id, event, channel, locale, subject, body) values
  ('33333333-3333-3333-3333-333333333333', 'rent_overdue', 'email', 'en',
   'Overdue notice', 'OVERDUE|{{amount}}|{{due_date}}|{{lease_no}}');
insert into public.charges (id, org_id, lease_id, type, description, period_start, due_date, amount_minor, currency, status)
values ('99999999-9999-9999-9999-999999999999', '33333333-3333-3333-3333-333333333333',
        '55555555-5555-5555-5555-555555555555', 'rent', 'Interpolation fixture',
        current_date - 70, current_date - 20, 275000, 'QAR', 'pending');
update public.charges set status = 'overdue' where id = '99999999-9999-9999-9999-999999999999';
select is(
  (select body from public.notification_outbox
   where org_id = '33333333-3333-3333-3333-333333333333'
     and event = 'rent_overdue'
     and dedupe_key = 'charge-overdue:99999999-9999-9999-9999-999999999999'),
  'OVERDUE|2,750.00 QAR|' || to_char(current_date - 20, 'YYYY-MM-DD') || '|L-1',
  'rent_overdue template interpolates amount, due_date and lease_no'
);

-- FIX-ROUND-1: every trigger-enqueued row (all four prefixes, k2 rows excluded) is email.
select ok(
  (select coalesce(bool_and(channel = 'email'), false)
   from public.notification_outbox
   where org_id = '33333333-3333-3333-3333-333333333333'
     and (dedupe_key like 'payment:%' or dedupe_key like 'charge-overdue:%'
       or dedupe_key like 'maintenance-requested:%' or dedupe_key like 'maintenance-status:%')),
  'all trigger-enqueued rows use channel email'
);

-- FIX-ROUND-1: null tenant / null-email staff add no notification rows.
insert into public.maintenance_requests (id, org_id, building_id, title, status)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333',
        'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Null tenant', 'open');
update public.maintenance_requests set status = 'in_progress' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select is(
  (select count(*) from public.notification_outbox
   where org_id = '33333333-3333-3333-3333-333333333333'
     and event = 'maintenance_status_changed'
     and dedupe_key like 'maintenance-status:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa:%'),
  0::bigint, 'status change on a null-tenant request enqueues nothing'
);

insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111');
insert into public.org_members (org_id, user_id, role) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'caretaker');
insert into public.maintenance_requests (id, org_id, building_id, title, status)
values ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333',
        'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Null email staff', 'open');
select is(
  (select count(*) from public.notification_outbox
   where org_id = '33333333-3333-3333-3333-333333333333'
     and event = 'maintenance_requested'
     and dedupe_key = 'maintenance-requested:22222222-2222-2222-2222-222222222222'),
  1::bigint, 'null-email staff adds no maintenance_requested row'
);

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
  2::bigint, 'one late fee per overdue charge after two sweeps'
);

select * from finish();
rollback;
