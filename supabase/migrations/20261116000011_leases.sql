-- 0011_leases: leases, terms, occupants and the charge table (SPEC 5.3/5.4, D-012).
-- Availability rules live here rather than in the app (D-010 rule of location).

create table leases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  lease_no text not null,
  unit_id uuid references units (id),
  room_id uuid references rooms (id),
  parent_lease_id uuid references leases (id),
  tenant_id uuid not null references tenants (id),
  start_date date not null,
  end_date date not null,
  rent_minor bigint not null,
  currency char(3) not null references currencies (code),
  payment_frequency text not null,
  installments int not null default 12,
  due_day int not null default 1,
  deposit_minor bigint not null default 0,
  rent_collected_by text not null default 'landlord',
  sublet_approved_by uuid,
  sublet_approved_at timestamptz,
  registration_no text,
  registration_status text not null default 'pending',
  notice_days int not null default 60,
  status lease_status not null default 'draft',
  contract_path text,
  signed_at date,
  terminated_at date,
  termination_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (org_id, lease_no),
  check (end_date > start_date),
  check ((unit_id is not null)::int + (room_id is not null)::int = 1),
  check (payment_frequency in ('monthly', 'quarterly', 'semiannual', 'annual', 'custom')),
  check (installments > 0),
  check (due_day between 1 and 28),
  check (rent_collected_by in ('landlord', 'main_tenant')),
  check (rent_minor >= 0),
  check (deposit_minor >= 0)
);
create index leases_org_idx on leases (org_id);
create index leases_unit_idx on leases (unit_id);
create index leases_room_idx on leases (room_id);
create index leases_tenant_idx on leases (tenant_id);
create index leases_status_idx on leases (org_id, status);
create index leases_end_idx on leases (org_id, end_date);

alter table leases add constraint no_overlap_unit
  exclude using gist (unit_id with =, daterange(start_date, end_date, '[]') with &&)
  where (unit_id is not null and status = 'active');
alter table leases add constraint no_overlap_room
  exclude using gist (room_id with =, daterange(start_date, end_date, '[]') with &&)
  where (room_id is not null and status = 'active');

create table lease_terms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  lease_id uuid not null references leases (id) on delete cascade,
  effective_from date not null,
  rent_minor bigint not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (lease_id, effective_from)
);
create index lease_terms_lease_idx on lease_terms (lease_id);

create table lease_occupants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  lease_id uuid not null references leases (id) on delete cascade,
  tenant_id uuid references tenants (id),
  full_name text,
  relation text,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index lease_occupants_lease_idx on lease_occupants (lease_id);

-- Charges are created here because M2 generates a schedule. SPEC 5.4 shape, unchanged (D-012).
create table charges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  lease_id uuid not null references leases (id),
  type charge_type not null,
  description text,
  period_start date,
  period_end date,
  due_date date not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null references currencies (code),
  paid_minor bigint not null default 0 check (paid_minor >= 0 and paid_minor <= amount_minor),
  status charge_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (lease_id, type, period_start)
);
create index charges_lease_idx on charges (lease_id);
create index charges_due_idx on charges (org_id, due_date);
create index charges_status_idx on charges (org_id, status);

create trigger leases_set_updated_at before update on leases
  for each row execute function set_updated_at();
create trigger leases_audit after insert or update or delete on leases
  for each row execute function audit_trigger();
create trigger charges_set_updated_at before update on charges
  for each row execute function set_updated_at();

-- Helpers -------------------------------------------------------------------

create or replace function public.lease_building_id(p_lease uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select u.building_id from units u join leases l on l.unit_id = u.id where l.id = p_lease),
    (select u.building_id
     from rooms r join units u on u.id = r.unit_id
     join leases l on l.room_id = r.id
     where l.id = p_lease)
  )
$$;

create or replace function public.lease_capacity(p_lease uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select r.capacity from rooms r join leases l on l.room_id = r.id where l.id = p_lease),
    (select greatest(coalesce(u.bedrooms, 1) + 2, 1)
     from units u join leases l on l.unit_id = u.id where l.id = p_lease)
  )
$$;

-- Triggers ------------------------------------------------------------------

-- Whole-unit and room leases on the same unit are mutually exclusive while active (SPEC 7.6).
create or replace function enforce_room_vs_unit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_unit uuid;
begin
  if new.status <> 'active' then
    return new;
  end if;

  if new.unit_id is not null then
    if exists (
      select 1 from leases l
      join rooms r on r.id = l.room_id
      where r.unit_id = new.unit_id
        and l.status = 'active'
        and l.id <> new.id
    ) then
      raise exception 'unit already leased as rooms' using errcode = '23514';
    end if;
  end if;

  if new.room_id is not null then
    select unit_id into v_unit from rooms where id = new.room_id;
    if exists (
      select 1 from leases l
      where l.unit_id = v_unit
        and l.status = 'active'
        and l.id <> new.id
    ) then
      raise exception 'unit already leased as a whole' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger leases_room_vs_unit before insert or update of unit_id, room_id, status on leases
  for each row execute function enforce_room_vs_unit();

-- Sub-letting (Mode B): the parent must be active and the sub-let approved before activation.
create or replace function enforce_sublet() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_parent leases;
begin
  if new.parent_lease_id is null then
    return new;
  end if;

  select * into v_parent from leases where id = new.parent_lease_id;
  if not found then
    raise exception 'parent lease not found' using errcode = '23503';
  end if;
  if v_parent.org_id <> new.org_id then
    raise exception 'parent lease belongs to another organization' using errcode = '23514';
  end if;

  if new.sublet_approved_by is not null and auth_role() <> 'org_admin' then
    raise exception 'only an org admin may approve a sub-let' using errcode = '42501';
  end if;

  if new.status = 'active' then
    if v_parent.status <> 'active' then
      raise exception 'parent lease is not active' using errcode = '23514';
    end if;
    if new.sublet_approved_by is null then
      raise exception 'sub-let needs approval before activation' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger leases_sublet before insert or update on leases
  for each row execute function enforce_sublet();

-- Capacity is checked where occupants are added, not only at activation.
create or replace function enforce_occupancy() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_capacity int;
  v_count int;
begin
  v_capacity := lease_capacity(new.lease_id);
  select count(*) into v_count from lease_occupants where lease_id = new.lease_id;
  if v_capacity is not null and v_count > v_capacity then
    raise exception 'occupants exceed capacity %', v_capacity using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger lease_occupants_capacity after insert or update on lease_occupants
  for each row execute function enforce_occupancy();

-- Unit status follows active and reserved leases; maintenance is owned by M4.
-- shortcut: maintenance blocks are not considered, revisit when maintenance lands.
create or replace function derive_unit_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_unit uuid;
begin
  if tg_op = 'DELETE' then
    v_unit := coalesce(
      old.unit_id,
      (select r.unit_id from rooms r where r.id = old.room_id)
    );
  else
    v_unit := coalesce(
      new.unit_id,
      (select r.unit_id from rooms r where r.id = new.room_id)
    );
  end if;

  if v_unit is null then
    return null;
  end if;

  update units u
  set status = case
    when exists (
      select 1 from leases l
      left join rooms r on r.id = l.room_id
      where l.status = 'active'
        and (l.unit_id = v_unit or r.unit_id = v_unit)
    ) then 'occupied'::unit_status
    when exists (
      select 1 from leases l
      left join rooms r on r.id = l.room_id
      where l.status = 'draft'
        and l.start_date > current_date
        and (l.unit_id = v_unit or r.unit_id = v_unit)
    ) then 'reserved'::unit_status
    else 'vacant'::unit_status
  end
  where u.id = v_unit and u.status <> 'maintenance';

  return null;
end;
$$;

create trigger leases_unit_status after insert or update or delete on leases
  for each row execute function derive_unit_status();

-- Policies ------------------------------------------------------------------

alter table leases enable row level security;
alter table lease_terms enable row level security;
alter table lease_occupants enable row level security;
alter table charges enable row level security;

create policy leases_select on leases for select to authenticated
  using (org_id = auth_org() and can_access_building(lease_building_id(id)));
create policy leases_insert on leases for insert to authenticated
  with check (org_id = auth_org() and auth_role() in ('org_admin', 'manager'));
create policy leases_update on leases for update to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager'))
  with check (org_id = auth_org());
create policy leases_delete on leases for delete to authenticated
  using (org_id = auth_org() and auth_role() = 'org_admin');

create policy lease_terms_select on lease_terms for select to authenticated
  using (org_id = auth_org() and can_access_building(lease_building_id(lease_id)));
create policy lease_terms_write on lease_terms for insert to authenticated
  with check (org_id = auth_org() and auth_role() in ('org_admin', 'manager'));

create policy lease_occupants_select on lease_occupants for select to authenticated
  using (org_id = auth_org() and can_access_building(lease_building_id(lease_id)));
create policy lease_occupants_insert on lease_occupants for insert to authenticated
  with check (org_id = auth_org() and auth_role() in ('org_admin', 'manager'));
create policy lease_occupants_delete on lease_occupants for delete to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager'));

-- Charges are written only by RPCs; direct writes would bypass schedule rules.
create policy charges_select on charges for select to authenticated
  using (org_id = auth_org() and can_access_building(lease_building_id(lease_id)));
