-- pgTAP: public marketplace listings, anon enquiries and cross-tenant isolation.
begin;

create extension if not exists pgtap;

select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'marketplace-a@test.dev'),
  ('00000000-0000-0000-0000-0000000000a2', 'marketplace-b@test.dev');

insert into organizations (id, name, slug) values
  ('a1111111-1111-1111-1111-111111111111', 'Marketplace Org A', 'marketplace-a'),
  ('a2222222-2222-2222-2222-222222222222', 'Marketplace Org B', 'marketplace-b');

insert into owners (id, org_id, name, is_company_self) values
  ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Owner A', true),
  ('b2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'Owner B', true);

insert into buildings (id, org_id, owner_id, code, name, country_code, city) values
  ('c1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'BA1', 'Building A', 'QA', 'Doha'),
  ('c2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'BB1', 'Building B', 'QA', 'Doha');

insert into floors (id, org_id, building_id, level) values
  ('d1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 1),
  ('d2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 1);

insert into units (id, org_id, building_id, floor_id, unit_no, status, is_listed_publicly, listing_slug, default_rent_minor, currency) values
  ('e1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', '101', 'vacant', true, 'doha-building-a-101', 350000, 'QAR'),
  ('e2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'd2222222-2222-2222-2222-222222222222', '201', 'vacant', true, 'doha-building-b-201', 420000, 'QAR'),
  ('e3333333-3333-3333-3333-333333333333', 'a1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', '102', 'vacant', false, 'doha-building-a-102', 310000, 'QAR');

select has_table('public', 'listing_images', 'listing_images exists');
select has_table('public', 'listing_enquiries', 'listing_enquiries exists');
select has_column('public', 'buildings', 'is_listed_publicly', 'buildings have a public-listing flag');
select has_column('public', 'units', 'listing_slug', 'units have a listing slug');
select has_column('public', 'units', 'is_listed_publicly', 'units have a public-listing flag');
select ok((select relrowsecurity from pg_class where oid = to_regclass('public.listing_images')),
  'listing_images has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = to_regclass('public.listing_enquiries')),
  'listing_enquiries has RLS enabled');
select has_view('public', 'public_listings', 'public_listings view exists');

-- Anonymous marketplace visitor.
set local role anon;
select set_config('request.jwt.claims', '{}', true);

select is((select count(*) from public_listings), 2::bigint,
  'anon sees the publicly listed units from both orgs');
select is((select count(*) from public_listings where slug = 'doha-building-a-102'), 0::bigint,
  'anon cannot see a unit whose org opted out of public listing');
select lives_ok($$ insert into listing_enquiries (org_id, unit_id, name, email, message)
  values ('a1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111',
          'Visitor', 'visitor@test.dev', 'Is this available?') $$,
  'anon can enquire about a publicly listed unit');
select throws_ok($$ insert into listing_enquiries (org_id, unit_id, name, email, message)
  values ('a1111111-1111-1111-1111-111111111111', 'e3333333-3333-3333-3333-333333333333',
          'Visitor', 'visitor@test.dev', 'Is this available?') $$,
  '42501', null, 'anon cannot enquire about a hidden unit');
select throws_ok($$ select * from listing_enquiries $$,
  '42501', null, 'anon cannot read the enquiry inbox');

-- Org A staff: sees only its own leads.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","org_id":"a1111111-1111-1111-1111-111111111111","org_role":"org_admin"}', true);

insert into listing_enquiries (org_id, unit_id, name, email, message, status)
values ('a2222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222',
        'Other org lead', 'other@test.dev', 'hidden', 'new');

select is((select count(*) from listing_enquiries), 1::bigint,
  'org A staff sees only org A enquiries');
select is((select count(*) from listing_enquiries where email = 'other@test.dev'), 0::bigint,
  'org A staff cannot read org B enquiries');

-- Public bucket for crawlable listing images.
select is((select public from storage.buckets where id = 'listing-images'), true,
  'listing-images bucket allows public read');

rollback;
