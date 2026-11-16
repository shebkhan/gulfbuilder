-- 0002_property: buildings, floors, units, rooms, building access.
-- `owners` lives in 0001_core (D-002). Covers SPEC 5.2 except owner columns, which already exist.

create table buildings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  owner_id uuid not null references owners (id),
  code text not null,
  name text not null,
  country_code char(2) not null,
  city text,
  zone text,
  street text,
  building_no text,
  national_address jsonb,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  amenities text[] not null default '{}',
  property_value_minor bigint,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (org_id, code),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);
create index buildings_org_idx on buildings (org_id);
create index buildings_owner_idx on buildings (owner_id);

create table floors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  building_id uuid not null references buildings (id) on delete cascade,
  level int not null,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (building_id, level)
);
create index floors_org_idx on floors (org_id);

create table units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  building_id uuid not null references buildings (id) on delete cascade,
  floor_id uuid not null references floors (id) on delete cascade,
  unit_no text not null,
  unit_type text,
  occupancy_type text not null default 'family',
  bedrooms int,
  bathrooms int,
  area_sqm numeric(8, 2),
  furnished boolean not null default false,
  rentable_as text not null default 'whole',
  default_rent_minor bigint,
  currency char(3) references currencies (code),
  status unit_status not null default 'vacant',
  electricity_no text,
  water_no text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (building_id, unit_no),
  check (occupancy_type in ('family', 'bachelor', 'staff', 'commercial')),
  check (rentable_as in ('whole', 'rooms')),
  check (area_sqm is null or area_sqm > 0),
  check (bedrooms is null or bedrooms >= 0)
);
create index units_org_idx on units (org_id);
create index units_building_idx on units (building_id);
create index units_floor_idx on units (floor_id);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  unit_id uuid not null references units (id) on delete cascade,
  room_no text not null,
  label text,
  capacity int not null default 1,
  area_sqm numeric(6, 2),
  private_bathroom boolean not null default false,
  default_rent_minor bigint,
  currency char(3) references currencies (code),
  status unit_status not null default 'vacant',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (unit_id, room_no),
  check (capacity > 0)
);
create index rooms_org_idx on rooms (org_id);
create index rooms_unit_idx on rooms (unit_id);

-- member_building_access was created in 0001 before buildings existed.
alter table member_building_access
  add constraint member_building_access_building_fk
  foreign key (building_id) references buildings (id) on delete cascade;

-- Access scope (D-004): admins and accountants see the whole org; managers and
-- caretakers need an access row; owners see buildings they own.
create or replace function can_access_building(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth_role() in ('org_admin', 'accountant')
     or exists (
       select 1 from member_building_access m
       where m.user_id = auth.uid() and m.building_id = b
     )
     or exists (
       select 1 from buildings bl
       join owners o on o.id = bl.owner_id
       where bl.id = b and o.user_id = auth.uid()
     )
$$;
grant execute on function can_access_building(uuid) to authenticated;

-- triggers ------------------------------------------------------------------
create trigger buildings_set_updated_at before update on buildings
  for each row execute function set_updated_at();
create trigger buildings_audit after insert or update or delete on buildings
  for each row execute function audit_trigger();
create trigger floors_set_updated_at before update on floors
  for each row execute function set_updated_at();
create trigger floors_audit after insert or update or delete on floors
  for each row execute function audit_trigger();
create trigger units_set_updated_at before update on units
  for each row execute function set_updated_at();
create trigger units_audit after insert or update or delete on units
  for each row execute function audit_trigger();
create trigger rooms_set_updated_at before update on rooms
  for each row execute function set_updated_at();
create trigger rooms_audit after insert or update or delete on rooms
  for each row execute function audit_trigger();

-- RLS -----------------------------------------------------------------------
alter table buildings enable row level security;
alter table floors enable row level security;
alter table units enable row level security;
alter table rooms enable row level security;

create policy buildings_select on buildings for select to authenticated
  using (org_id = auth_org() and can_access_building(id));
create policy buildings_insert on buildings for insert to authenticated
  with check (org_id = auth_org() and auth_role() in ('org_admin', 'manager'));
create policy buildings_update on buildings for update to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager'))
  with check (org_id = auth_org());
create policy buildings_delete on buildings for delete to authenticated
  using (org_id = auth_org() and auth_role() = 'org_admin');

create policy floors_select on floors for select to authenticated
  using (org_id = auth_org() and can_access_building(building_id));
create policy floors_write on floors for all to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager'))
  with check (org_id = auth_org());

create policy units_select on units for select to authenticated
  using (org_id = auth_org() and can_access_building(building_id));
create policy units_write on units for all to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager'))
  with check (org_id = auth_org());

create policy rooms_select on rooms for select to authenticated
  using (
    org_id = auth_org()
    and exists (
      select 1 from units u where u.id = rooms.unit_id and can_access_building(u.building_id)
    )
  );
create policy rooms_write on rooms for all to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager'))
  with check (org_id = auth_org());

-- Bulk generation ------------------------------------------------------------
-- Floors by level range: 0..12 creates any level not already present.
create or replace function generate_floors(
  p_building uuid,
  p_from int,
  p_to int
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := auth_org();
  v_count int;
begin
  if auth.uid() is null or v_org is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if auth_role() not in ('org_admin', 'manager') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from buildings where id = p_building and org_id = v_org) then
    raise exception 'building not in organization' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 199 then
    raise exception 'invalid level range' using errcode = '22023';
  end if;

  insert into floors (org_id, building_id, level, created_by)
  select v_org, p_building, lvl, auth.uid()
  from generate_series(p_from, p_to) as lvl
  on conflict (building_id, level) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function generate_floors(uuid, int, int) from public;
grant execute on function generate_floors(uuid, int, int) to authenticated;

-- Units per floor: unit_no = prefix || lpad(start + i, pad, '0').
create or replace function generate_units(
  p_floor uuid,
  p_prefix text default '',
  p_start int default 1,
  p_count int default 1,
  p_pad int default 2,
  p_unit_type text default null,
  p_area_sqm numeric default null,
  p_rent_minor bigint default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := auth_org();
  v_building uuid;
  v_currency char(3);
  v_count int;
begin
  if auth.uid() is null or v_org is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if auth_role() not in ('org_admin', 'manager') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_count < 1 or p_count > 500 then
    raise exception 'unit count must be between 1 and 500' using errcode = '22023';
  end if;

  select f.building_id into v_building
  from floors f where f.id = p_floor and f.org_id = v_org;
  if v_building is null then
    raise exception 'floor not in organization' using errcode = '42501';
  end if;

  select base_currency into v_currency from organizations where id = v_org;

  insert into units (
    org_id, building_id, floor_id, unit_no, unit_type, area_sqm,
    default_rent_minor, currency, created_by
  )
  select
    v_org, v_building, p_floor,
    p_prefix || lpad((p_start + i)::text, greatest(p_pad, 1), '0'),
    p_unit_type, p_area_sqm, p_rent_minor, v_currency, auth.uid()
  from generate_series(0, p_count - 1) as i
  on conflict (building_id, unit_no) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function generate_units(uuid, text, int, int, int, text, numeric, bigint) from public;
grant execute on function generate_units(uuid, text, int, int, int, text, numeric, bigint) to authenticated;
