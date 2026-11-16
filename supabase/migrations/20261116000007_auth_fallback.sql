-- 0007_auth_fallback: work without the dashboard token hook.
-- SPEC 6 expects `org_id`/`org_role` claims from a custom access token hook, but the
-- hook is a dashboard toggle that is easy to forget. The helpers now fall back to
-- `profiles.active_org_id` and the matching membership row. Claims still win when
-- present, so enabling the hook removes the extra lookup (see docs/DECISIONS.md).

create or replace function auth_org() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(auth.jwt() ->> 'org_id', '')::uuid,
    (select p.active_org_id from profiles p where p.id = auth.uid())
  )
$$;

create or replace function auth_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(auth.jwt() ->> 'org_role', ''),
    (
      select m.role::text
      from org_members m
      where m.user_id = auth.uid()
        and m.org_id = coalesce(
          nullif(auth.jwt() ->> 'org_id', '')::uuid,
          (select p.active_org_id from profiles p where p.id = auth.uid())
        )
      limit 1
    )
  )
$$;

-- Existing members without an active org get their first membership.
update profiles p
set active_org_id = (
  select m.org_id from org_members m
  where m.user_id = p.id
  order by m.created_at
  limit 1
)
where p.active_org_id is null;

-- Organization creation makes the new org active for its creator.
create or replace function create_organization(
  p_name text,
  p_slug text,
  p_country_code char(2) default 'QA',
  p_base_currency char(3) default 'QAR',
  p_locale text default 'en'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from organizations o where o.slug = p_slug) then
    raise exception 'slug already taken' using errcode = '23505';
  end if;

  insert into organizations (name, slug, country_code, base_currency, default_locale, created_by)
  values (p_name, p_slug, p_country_code, p_base_currency, p_locale, auth.uid())
  returning id into v_org;

  insert into org_branding (org_id, app_name, created_by)
  values (v_org, p_name, auth.uid());

  insert into profiles (id, locale, active_org_id, created_by)
  values (auth.uid(), p_locale, v_org, auth.uid())
  on conflict (id) do update set active_org_id = excluded.active_org_id;

  insert into org_members (org_id, user_id, role, created_by)
  values (v_org, auth.uid(), 'org_admin', auth.uid());

  insert into owners (org_id, name, is_company_self, ownership_model, created_by)
  values (v_org, p_name, true, 'self', auth.uid());

  return v_org;
end;
$$;
