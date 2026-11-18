-- pgTAP: global theme presets and public branding storage bucket policies.
-- Run with `pnpm db:test` (supabase test db --linked).
begin;

create extension if not exists pgtap;

select plan(20);

-- fixtures -----------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'preset-admin-a@test.dev');

insert into organizations (id, name, slug) values
  ('33333333-3333-3333-3333-333333333333', 'Preset Org A', 'preset-org-a');

insert into org_members (org_id, user_id, role) values
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-0000000000f1', 'org_admin');

-- structure ----------------------------------------------------------------
select has_table('public', 'theme_presets', 'theme_presets table exists');
select ok((select relrowsecurity from pg_class where oid = to_regclass('public.theme_presets')),
  'theme_presets has RLS enabled');

-- service-role equivalent: postgres bypasses RLS to seed a readable row
insert into theme_presets (code, name, primary_color, secondary_color, font_family, created_by)
values ('preset-a', 'Preset A', '#112233', '#445566', 'Inter, Arial',
        '00000000-0000-0000-0000-0000000000f1');

-- signed in as org A admin ------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f1","org_id":"33333333-3333-3333-3333-333333333333","org_role":"org_admin"}', true);

select is((select count(*) from theme_presets), 1::bigint,
  'authenticated can select theme presets');
select throws_ok($$ insert into theme_presets (code, name, primary_color, secondary_color, font_family)
  values ('evil', 'Evil', '#000000', '#ffffff', 'Arial') $$,
  null, null, 'authenticated cannot insert into theme_presets');
select is_empty($$ update theme_presets set name = 'Hacked' where code = 'preset-a' returning code $$,
  'authenticated cannot update theme_presets');
select is_empty($$ delete from theme_presets where code = 'preset-a' returning code $$,
  'authenticated cannot delete theme_presets');

-- anonymous ---------------------------------------------------------------
set local role anon;
select is((select count(*) from theme_presets), 0::bigint,
  'anon cannot select theme presets');
select throws_ok($$ insert into theme_presets (code, name, primary_color, secondary_color, font_family)
  values ('evil', 'Evil', '#000000', '#ffffff', 'Arial') $$,
  null, null, 'anon cannot insert into theme_presets');
select is_empty($$ update theme_presets set name = 'Hacked' where code = 'preset-a' returning code $$,
  'anon cannot update theme_presets');
select is_empty($$ delete from theme_presets where code = 'preset-a' returning code $$,
  'anon cannot delete theme_presets');

-- constraints (service role, RLS bypassed) ---------------------------------
reset role;
update theme_presets set is_default = true where code = 'preset-a';
select throws_ok($$ insert into theme_presets (code, name, primary_color, secondary_color, font_family, is_default)
  values ('preset-b', 'Preset B', '#000000', '#ffffff', 'Arial', true) $$,
  '23505', null, 'at most one default theme preset');
select throws_ok($$ insert into theme_presets (code, name, primary_color, secondary_color, font_family)
  values ('bad-color', 'Bad', 'red', '#ffffff', 'Arial') $$,
  '23514', null, 'preset colours must be 6-digit hex');
select throws_ok($$ insert into theme_presets (code, name, primary_color, secondary_color, font_family)
  values ('bad-font', 'Bad', '#000000', '#ffffff', 'Arial; } body {') $$,
  '23514', null, 'preset font family rejects CSS delimiters');

-- branding bucket ----------------------------------------------------------
select is((select count(*) from storage.buckets where id = 'branding'), 1::bigint,
  'branding bucket exists');
select ok((select public from storage.buckets where id = 'branding'),
  'branding bucket is public');

-- storage: anonymous writes are denied -------------------------------------
set local role anon;
select throws_ok($$ insert into storage.objects (bucket_id, name)
  values ('branding', '33333333-3333-3333-3333-333333333333/logo/x.png') $$,
  null, null, 'anon cannot write to the branding bucket');

-- storage: org A admin writes into their own prefix ------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f1","org_id":"33333333-3333-3333-3333-333333333333","org_role":"org_admin"}', true);
select lives_ok($$ insert into storage.objects (bucket_id, name)
  values ('branding', '33333333-3333-3333-3333-333333333333/logo/x.png') $$,
  'org admin can upload into their own org prefix');

-- storage: public read of branding objects ---------------------------------
set local role anon;
select is((select count(*) from storage.objects
  where bucket_id = 'branding' and name = '33333333-3333-3333-3333-333333333333/logo/x.png'), 1::bigint,
  'anon can read branding objects');

-- storage: cross-tenant and non-admin writes are denied --------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f1","org_id":"33333333-3333-3333-3333-333333333333","org_role":"org_admin"}', true);
select throws_ok($$ insert into storage.objects (bucket_id, name)
  values ('branding', '44444444-4444-4444-4444-444444444444/logo/x.png') $$,
  null, null, 'org admin cannot write into another org prefix');
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f1","org_id":"33333333-3333-3333-3333-333333333333","org_role":"manager"}', true);
select throws_ok($$ insert into storage.objects (bucket_id, name)
  values ('branding', '33333333-3333-3333-3333-333333333333/logo/y.png') $$,
  null, null, 'non-admin cannot write to the branding bucket');

select * from finish();
rollback;
