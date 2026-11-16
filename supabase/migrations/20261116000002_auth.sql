-- 0002_auth: active organization, access-token hook, org switching.
-- The hook must also be enabled in the dashboard: Authentication > Hooks > Custom Access Token.
-- TODO(owner): O1 hosting region is still open; hook setup is per project.

alter table profiles
  add column active_org_id uuid references organizations (id);

-- Active org: used by the hook and by the org switcher.
create or replace function set_active_org(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (
    select 1 from org_members m where m.user_id = auth.uid() and m.org_id = p_org
  ) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;

  insert into profiles (id, active_org_id, created_by)
  values (auth.uid(), p_org, auth.uid())
  on conflict (id) do update set active_org_id = excluded.active_org_id;
end;
$$;

revoke all on function set_active_org(uuid) from public;
grant execute on function set_active_org(uuid) to authenticated;

-- Custom access token hook: adds org_id and org_role for the active organization (SPEC 6).
create or replace function custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable set search_path = public as $$
declare
  v_org uuid;
  v_role text;
  claims jsonb;
begin
  select m.org_id, m.role::text
    into v_org, v_role
  from org_members m
  join profiles p on p.id = m.user_id
  where m.user_id = (event ->> 'user_id')::uuid
  order by (m.org_id = coalesce(p.active_org_id, m.org_id)) desc, m.created_at
  limit 1;

  claims := coalesce(event -> 'claims', '{}'::jsonb);

  if v_org is not null then
    claims := jsonb_set(claims, '{org_id}', to_jsonb(v_org));
    claims := jsonb_set(claims, '{org_role}', to_jsonb(v_role));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- The hook runs as supabase_auth_admin, which is subject to RLS.
grant usage on schema public to supabase_auth_admin;
grant execute on function custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function custom_access_token_hook(jsonb) from authenticated, anon, public;

grant select on org_members, profiles to supabase_auth_admin;

create policy org_members_auth_admin on org_members for select to supabase_auth_admin using (true);
create policy profiles_auth_admin on profiles for select to supabase_auth_admin using (true);
