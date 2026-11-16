-- 0005_property_units_prefix: unit numbers are unique per building, so a bulk
-- order that omits a prefix must derive one from the floor level or the second
-- floor silently conflicts with the first. Default prefix = level + 1.

create or replace function generate_units(
  p_floor uuid,
  p_prefix text default null,
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
  v_level int;
  v_prefix text;
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

  select f.building_id, f.level into v_building, v_level
  from floors f where f.id = p_floor and f.org_id = v_org;
  if v_building is null then
    raise exception 'floor not in organization' using errcode = '42501';
  end if;

  v_prefix := coalesce(p_prefix, case when v_level < 0 then 'B' || abs(v_level) else (v_level + 1)::text end);

  select base_currency into v_currency from organizations where id = v_org;

  insert into units (
    org_id, building_id, floor_id, unit_no, unit_type, area_sqm,
    default_rent_minor, currency, created_by
  )
  select
    v_org, v_building, p_floor,
    v_prefix || lpad((p_start + i)::text, greatest(p_pad, 1), '0'),
    p_unit_type, p_area_sqm, p_rent_minor, v_currency, auth.uid()
  from generate_series(0, p_count - 1) as i
  on conflict (building_id, unit_no) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
