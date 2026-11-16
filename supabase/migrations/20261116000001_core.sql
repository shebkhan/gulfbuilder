-- 0001_core: extensions, enums, tenancy, audit.
-- Deviation from SPEC 5.2: `owners` lives here so org creation can create the
-- self-owner atomically; see docs/DECISIONS.md. Property tables stay in 0002.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- enums -------------------------------------------------------------------
create type member_role as enum ('org_admin', 'manager', 'accountant', 'caretaker', 'owner', 'tenant');
create type ownership_model as enum ('self', 'managed');
create type unit_status as enum ('vacant', 'occupied', 'reserved', 'maintenance');
create type lease_status as enum ('draft', 'active', 'expired', 'terminated', 'renewed');
create type charge_type as enum ('rent', 'deposit', 'utility', 'maintenance', 'late_fee', 'other');
create type charge_status as enum ('pending', 'partial', 'paid', 'overdue', 'void');
create type payment_method as enum ('cash', 'bank_transfer', 'cheque', 'card', 'online');
create type cheque_status as enum ('received', 'deposited', 'cleared', 'bounced', 'returned', 'replaced');
create type maint_status as enum ('open', 'assigned', 'in_progress', 'resolved', 'closed', 'cancelled');
create type maint_priority as enum ('low', 'normal', 'high', 'urgent');

-- reference data -----------------------------------------------------------
create table currencies (
  code char(3) primary key,
  name text not null,
  exponent smallint not null
);

insert into currencies (code, name, exponent) values
  ('QAR', 'Qatari Riyal', 2),
  ('AED', 'UAE Dirham', 2),
  ('SAR', 'Saudi Riyal', 2),
  ('KWD', 'Kuwaiti Dinar', 3),
  ('BHD', 'Bahraini Dinar', 3),
  ('OMR', 'Omani Rial', 3);

create table market_packs (
  country_code char(2) not null,
  version int not null,
  effective_from date not null,
  rules jsonb not null,
  primary key (country_code, version)
);

-- tenancy ------------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  tax_id text,
  slug text unique not null,
  country_code char(2) not null default 'QA',
  base_currency char(3) not null default 'QAR' references currencies (code),
  default_locale text not null default 'en',
  timezone text not null default 'Asia/Qatar',
  settings jsonb not null default '{}',
  plan text not null default 'trial',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table org_branding (
  org_id uuid primary key references organizations (id),
  app_name text,
  logo_url text,
  favicon_url text,
  primary_color text,
  secondary_color text,
  font_family text,
  custom_domain text unique,
  email_from text,
  terminology jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  locale text default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table org_members (
  org_id uuid not null references organizations (id),
  user_id uuid not null references auth.users (id) on delete cascade,
  role member_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  primary key (org_id, user_id)
);

create table member_building_access (
  org_id uuid not null references organizations (id),
  user_id uuid not null references auth.users (id) on delete cascade,
  building_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  primary key (user_id, building_id)
);

create table owners (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  name text not null,
  is_company_self boolean not null default false,
  ownership_model ownership_model not null default 'managed',
  user_id uuid references auth.users (id) on delete set null,
  contact jsonb not null default '{}',
  fee_type text not null default 'percent_of_collections',
  fee_value numeric(12, 4) not null default 0,
  letting_fee_months numeric(4, 2) not null default 0,
  fee_tax_applicable boolean not null default false,
  reserve_pct numeric(5, 2) not null default 0,
  reserve_minor bigint not null default 0,
  approval_threshold_minor bigint,
  payout_frequency text not null default 'monthly',
  payout_details jsonb not null default '{}',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  check (not is_company_self or ownership_model = 'self')
);
create unique index one_self_owner_per_org on owners (org_id) where is_company_self;
create index owners_org_idx on owners (org_id);

-- audit --------------------------------------------------------------------
-- SPEC 5.8 places audit_log last; it is created here because M0 must attach
-- audit triggers to the core tables. 0008 only adds notification/platform tables.
create table audit_log (
  id bigint generated always as identity primary key,
  org_id uuid,
  actor_id uuid,
  table_name text not null,
  row_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  at timestamptz not null default now()
);
create index audit_log_org_idx on audit_log (org_id, at desc);

-- trigger functions --------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  payload jsonb;
begin
  payload := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  insert into audit_log (org_id, actor_id, table_name, row_id, action, old_data, new_data)
  values (
    case
      when payload ? 'org_id' then (payload ->> 'org_id')::uuid
      when tg_table_name = 'organizations' then (payload ->> 'id')::uuid
    end,
    auth.uid(),
    tg_table_name,
    (payload ->> 'id')::uuid,
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end;
$$;

-- auth helpers (SPEC 6) ----------------------------------------------------
create or replace function auth_org() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'org_id', '')::uuid
$$;

create or replace function auth_role() returns text
language sql stable as $$
  select auth.jwt() ->> 'org_role'
$$;

-- updated_at + audit triggers for core tables ------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['organizations', 'org_branding', 'profiles', 'org_members',
                           'member_building_access', 'owners']
  loop
    execute format('create trigger %I_set_updated_at before update on %I
                    for each row execute function set_updated_at()', t, t);
    execute format('create trigger %I_audit after insert or update or delete on %I
                    for each row execute function audit_trigger()', t, t);
  end loop;
end;
$$;

-- RLS ----------------------------------------------------------------------
alter table organizations enable row level security;
alter table org_branding enable row level security;
alter table profiles enable row level security;
alter table org_members enable row level security;
alter table member_building_access enable row level security;
alter table owners enable row level security;
alter table currencies enable row level security;
alter table market_packs enable row level security;
alter table audit_log enable row level security;

-- reference data is readable by any signed-in user, writable by nobody
create policy currencies_read on currencies for select to authenticated using (true);
create policy market_packs_read on market_packs for select to authenticated using (true);

-- organizations: members see their orgs; only org_admin updates
create policy organizations_select on organizations for select to authenticated
  using (
    id = auth_org()
    or exists (
      select 1 from org_members m
      where m.user_id = auth.uid() and m.org_id = organizations.id
    )
  );
create policy organizations_update on organizations for update to authenticated
  using (id = auth_org() and auth_role() = 'org_admin')
  with check (id = auth_org());

create policy org_branding_select on org_branding for select to authenticated
  using (org_id = auth_org());
create policy org_branding_write on org_branding for all to authenticated
  using (org_id = auth_org() and auth_role() = 'org_admin')
  with check (org_id = auth_org());

-- profiles: own row, plus teammates in the same org (name/phone for lists)
create policy profiles_select on profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from org_members m
      where m.user_id = profiles.id and m.org_id = auth_org()
    )
  );
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
create policy profiles_insert on profiles for insert to authenticated
  with check (id = auth.uid());

-- org_members: a user always sees their own membership (org switcher)
create policy org_members_select on org_members for select to authenticated
  using (org_id = auth_org() or user_id = auth.uid());
create policy org_members_write on org_members for all to authenticated
  using (org_id = auth_org() and auth_role() = 'org_admin')
  with check (org_id = auth_org());

create policy member_building_access_select on member_building_access for select to authenticated
  using (
    user_id = auth.uid()
    or (org_id = auth_org() and auth_role() in ('org_admin', 'manager', 'accountant'))
  );
create policy member_building_access_write on member_building_access for all to authenticated
  using (org_id = auth_org() and auth_role() = 'org_admin')
  with check (org_id = auth_org());

-- owners: admin/manager write, staff read, owner reads own record
create policy owners_select on owners for select to authenticated
  using (
    org_id = auth_org()
    and (
      auth_role() in ('org_admin', 'manager', 'accountant')
      or user_id = auth.uid()
    )
  );
create policy owners_insert on owners for insert to authenticated
  with check (org_id = auth_org() and auth_role() in ('org_admin', 'manager'));
create policy owners_update on owners for update to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager'))
  with check (org_id = auth_org());
create policy owners_delete on owners for delete to authenticated
  using (org_id = auth_org() and auth_role() = 'org_admin');

create policy audit_log_select on audit_log for select to authenticated
  using (org_id = auth_org() and auth_role() = 'org_admin');

-- organization creation ----------------------------------------------------
-- Must be an RPC: a client cannot insert its own membership row (that would
-- let anyone self-join any organization).
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

  insert into profiles (id, locale, created_by)
  values (auth.uid(), p_locale, auth.uid())
  on conflict (id) do nothing;

  insert into org_members (org_id, user_id, role, created_by)
  values (v_org, auth.uid(), 'org_admin', auth.uid());

  insert into owners (org_id, name, is_company_self, ownership_model, created_by)
  values (v_org, p_name, true, 'self', auth.uid());

  return v_org;
end;
$$;

revoke all on function create_organization(text, text, char, char, text) from public;
grant execute on function create_organization(text, text, char, char, text) to authenticated;
