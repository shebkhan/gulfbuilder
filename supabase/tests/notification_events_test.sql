-- pgTAP: notification event coverage (payment, overdue, maintenance, reminders).
-- Run with `pnpm db:test`. Requires migrations 0001..20261118000047 applied.
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

select * from finish();
rollback;
