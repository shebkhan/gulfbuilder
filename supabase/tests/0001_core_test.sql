-- pgTAP: core tenancy, RLS isolation, triggers, organization creation.
-- Run with `pnpm db:test` (supabase test db --linked).
begin;

create extension if not exists pgtap;

select plan(20);

-- fixtures -----------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin-a@test.dev'),
  ('00000000-0000-0000-0000-00000000000b', 'admin-b@test.dev'),
  ('00000000-0000-0000-0000-00000000000c', 'manager-a@test.dev'),
  ('00000000-0000-0000-0000-00000000000d', 'tenant-a@test.dev'),
  ('00000000-0000-0000-0000-00000000000e', 'owner-a@test.dev');

insert into organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'Org A', 'org-a'),
  ('22222222-2222-2222-2222-222222222222', 'Org B', 'org-b');

insert into org_members (org_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'org_admin'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-00000000000b', 'org_admin'),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000c', 'manager'),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000d', 'tenant'),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000e', 'owner');

insert into owners (id, org_id, name, ownership_model, user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Owner A1', 'self', '00000000-0000-0000-0000-00000000000e'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Owner A2', 'managed', null),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Owner B1', 'managed', null);

insert into market_packs (country_code, version, effective_from, rules)
values ('QA', 1, '2026-01-01', '{"weekend":["fri","sat"],"currency":"QAR"}');

insert into currencies (code, name, exponent) values ('USD', 'US Dollar', 2) on conflict do nothing;

-- structure ----------------------------------------------------------------
select has_table('public', 'owners', 'owners table exists');
select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'audit_log', 'audit_log table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.owners'::regclass),
  'owners has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.organizations'::regclass),
  'organizations has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.audit_log'::regclass),
  'audit_log has RLS enabled');

-- signed in as org A admin ------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","org_id":"11111111-1111-1111-1111-111111111111","org_role":"org_admin"}', true);

select is((select count(*) from owners), 2::bigint, 'org A admin sees only org A owners');
select is((select count(*) from owners where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  0::bigint, 'org A admin cannot read org B owner');
select lives_ok(
  $$ insert into owners (org_id, name, ownership_model)
     values ('11111111-1111-1111-1111-111111111111', 'Owner A3', 'managed') $$,
  'org admin can create an owner');
select lives_ok(
  $$ update owners set name = 'Owner A1 renamed'
     where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'org admin can update an owner');
select is(
  (select count(*) from audit_log
   where table_name = 'owners' and row_id = 'aaaaaaaa-0000-0000-0000-000000000001' and action = 'update'),
  1::bigint, 'owner update is written to audit_log');
select is((select count(*) from currencies where code = 'USD'), 1::bigint,
  'reference currencies are readable');
select is((select count(*) from market_packs where country_code = 'QA'), 1::bigint,
  'market packs are readable');

-- manager --------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000c","org_id":"11111111-1111-1111-1111-111111111111","org_role":"manager"}', true);

select is_empty(
  $$ update organizations set name = 'Hijacked' returning id $$,
  'manager cannot update organization settings');
select lives_ok(
  $$ insert into owners (org_id, name, ownership_model)
     values ('11111111-1111-1111-1111-111111111111', 'Owner A4', 'managed') $$,
  'manager can create owners (capability matrix)');

-- tenant ---------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000d","org_id":"11111111-1111-1111-1111-111111111111","org_role":"tenant"}', true);

select is((select count(*) from owners), 0::bigint, 'tenant cannot read owners');
select is((select count(*) from audit_log), 0::bigint, 'tenant cannot read the audit log');

-- owner ----------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000e","org_id":"11111111-1111-1111-1111-111111111111","org_role":"owner"}', true);

select is((select count(*) from owners), 1::bigint, 'owner sees only their own owner record');

-- org B admin ----------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","org_id":"22222222-2222-2222-2222-222222222222","org_role":"org_admin"}', true);

select is((select count(*) from owners), 1::bigint, 'org B admin sees only org B owners');

-- organization creation RPC -------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
select isnt(create_organization('New Org', 'new-org'), null::uuid,
  'create_organization returns a new organization id');
select is(
  (select count(*) from org_members m
   join organizations o on o.id = m.org_id
   where o.slug = 'new-org' and m.role = 'org_admin'),
  1::bigint, 'creating an organization makes the caller its org_admin');
select is(
  (select count(*) from owners w
   join organizations o on o.id = w.org_id
   where o.slug = 'new-org' and w.is_company_self),
  1::bigint, 'creating an organization creates its self owner');

-- updated_at trigger ---------------------------------------------------
reset role;
update owners set name = 'Owner A2' where id = 'aaaaaaaa-0000-0000-0000-000000000002';
select ok(
  (select updated_at > created_at from owners where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'set_updated_at keeps updated_at current');

select * from finish();
rollback;
