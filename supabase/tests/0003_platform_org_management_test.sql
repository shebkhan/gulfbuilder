-- pgTAP: per-org lookups and integration config used by the platform console.
begin;

create extension if not exists pgtap;

select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f2', 'platform-org-a@test.dev'),
  ('00000000-0000-0000-0000-0000000000f3', 'platform-org-b@test.dev');

insert into organizations (id, name, slug) values
  ('44444444-4444-4444-4444-444444444444', 'Platform Org A', 'platform-org-a'),
  ('55555555-5555-5555-5555-555555555555', 'Platform Org B', 'platform-org-b');

insert into org_members (org_id, user_id, role) values
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-0000000000f2', 'org_admin'),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-0000000000f3', 'tenant');

select has_table('public', 'org_lookups', 'org_lookups exists');
select has_table('public', 'org_integrations', 'org_integrations exists');
select ok((select relrowsecurity from pg_class where oid = to_regclass('public.org_lookups')),
  'org_lookups has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = to_regclass('public.org_integrations')),
  'org_integrations has RLS enabled');

insert into org_lookups (org_id, category, code, label)
values ('44444444-4444-4444-4444-444444444444', 'unit_type', 'studio', 'Studio');
insert into org_integrations (org_id, provider, config)
values ('44444444-4444-4444-4444-444444444444', 'telegram', '{"bot_name":"Demo","chat_id":"1"}');

select throws_ok($$ insert into org_lookups (org_id, category, code, label)
  values ('44444444-4444-4444-4444-444444444444', 'unit_type', 'studio', 'Duplicate') $$,
  '23505', null, 'duplicate lookup code is rejected');
select throws_ok($$ insert into org_integrations (org_id, provider, config)
  values ('44444444-4444-4444-4444-444444444444', 'telegram', '{}') $$,
  '23505', null, 'duplicate integration provider is rejected');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f2","org_id":"44444444-4444-4444-4444-444444444444","org_role":"org_admin"}', true);

select is((select count(*) from org_lookups), 1::bigint, 'org admin reads own lookups');
select is((select count(*) from org_integrations), 1::bigint, 'org admin reads own integrations');
select is_empty($$ insert into org_lookups (org_id, category, code, label)
  values ('55555555-5555-5555-5555-555555555555', 'unit_type', 'villa', 'Villa') returning id $$,
  'org admin cannot write another org lookups');
select is_empty($$ insert into org_integrations (org_id, provider, config)
  values ('55555555-5555-5555-5555-555555555555', 'telegram', '{}') returning id $$,
  'org admin cannot write another org integrations');
select is((select count(*) from org_lookups
  where org_id = '55555555-5555-5555-5555-555555555555'), 0::bigint,
  'org admin cannot see another org lookups');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f3","org_id":"55555555-5555-5555-5555-555555555555","org_role":"tenant"}', true);

select is((select count(*) from org_lookups), 0::bigint, 'tenant sees no lookups in own org');
select is_empty($$ insert into org_lookups (org_id, category, code, label)
  values ('55555555-5555-5555-5555-555555555555', 'unit_type', 'villa', 'Villa') returning id $$,
  'tenant cannot write lookups');
select is_empty($$ insert into org_integrations (org_id, provider, config)
  values ('55555555-5555-5555-5555-555555555555', 'telegram', '{}') returning id $$,
  'tenant cannot write integrations');

rollback;
