-- 0006_property_import: one-call import of buildings, floors and units from a
-- parsed CSV (rows arrive as JSON). Validation and writes share one transaction:
-- if any row fails, nothing is written and the report lists every failure.

create or replace function import_property_rows(
  p_rows jsonb,
  p_dry_run boolean default true
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := auth_org();
  v_currency char(3);
  v_self uuid;
  v_row jsonb;
  v_code text;
  v_owner uuid;
  v_building uuid;
  v_floor uuid;
  v_level int;
  v_buildings int := 0;
  v_floors int := 0;
  v_units int := 0;
  v_errors jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or v_org is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if auth_role() not in ('org_admin', 'manager') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be a JSON array' using errcode = '22023';
  end if;

  select base_currency into v_currency from organizations where id = v_org;
  select id into v_self from owners where org_id = v_org and is_company_self;

  begin
    for v_row in select * from jsonb_array_elements(p_rows) loop
      begin
        if v_row ->> 'kind' = 'building' then
          v_code := nullif(btrim(v_row ->> 'code'), '');
          if v_code is null then
            raise exception 'building code is required' using errcode = '22023';
          end if;
          if exists (select 1 from buildings where org_id = v_org and code = v_code) then
            raise exception 'building % already exists', v_code using errcode = '23505';
          end if;

          v_owner := coalesce(
            (select id from owners
              where org_id = v_org and name = nullif(btrim(v_row ->> 'owner'), '')),
            v_self
          );
          if v_owner is null then
            raise exception 'owner % not found', v_row ->> 'owner' using errcode = '23503';
          end if;

          insert into buildings (org_id, owner_id, code, name, country_code, city, created_by)
          values (
            v_org,
            v_owner,
            v_code,
            coalesce(nullif(btrim(v_row ->> 'name'), ''), v_code),
            upper(coalesce(nullif(btrim(v_row ->> 'country_code'), ''), 'QA')),
            nullif(btrim(v_row ->> 'city'), ''),
            auth.uid()
          );
          v_buildings := v_buildings + 1;

        elsif v_row ->> 'kind' = 'unit' then
          v_code := nullif(btrim(v_row ->> 'building'), '');
          if v_code is null then
            raise exception 'unit rows need a building code' using errcode = '22023';
          end if;
          select id into v_building from buildings where org_id = v_org and code = v_code;
          if v_building is null then
            raise exception 'building % not found', v_code using errcode = '23503';
          end if;
          if nullif(btrim(v_row ->> 'unit_no'), '') is null then
            raise exception 'unit_no is required' using errcode = '22023';
          end if;
          if exists (
            select 1 from units
            where building_id = v_building and unit_no = btrim(v_row ->> 'unit_no')
          ) then
            raise exception 'unit % already exists in %', v_row ->> 'unit_no', v_code
              using errcode = '23505';
          end if;

          v_level := coalesce((v_row ->> 'floor')::int, 0);
          select id into v_floor from floors where building_id = v_building and level = v_level;
          if v_floor is null then
            insert into floors (org_id, building_id, level, created_by)
            values (v_org, v_building, v_level, auth.uid())
            returning id into v_floor;
            v_floors := v_floors + 1;
          end if;

          insert into units (
            org_id, building_id, floor_id, unit_no, unit_type,
            area_sqm, default_rent_minor, currency, created_by
          ) values (
            v_org,
            v_building,
            v_floor,
            btrim(v_row ->> 'unit_no'),
            nullif(btrim(v_row ->> 'unit_type'), ''),
            (v_row ->> 'area_sqm')::numeric,
            (v_row ->> 'rent_minor')::bigint,
            v_currency,
            auth.uid()
          );
          v_units := v_units + 1;

        else
          raise exception 'unknown row type %', coalesce(v_row ->> 'kind', '(blank)')
            using errcode = '22023';
        end if;
      exception when others then
        v_errors := v_errors || jsonb_build_object(
          'row', coalesce(v_row ->> 'row', '?'),
          'message', sqlerrm
        );
      end;
    end loop;

    -- Dry run always rolls back; a real run with any error is all-or-nothing.
    if p_dry_run or jsonb_array_length(v_errors) > 0 then
      raise exception 'rollback import' using errcode = 'PX001';
    end if;
  exception when sqlstate 'PX001' then
    null;
  end;

  return jsonb_build_object(
    'dry_run', p_dry_run,
    'committed', not p_dry_run and jsonb_array_length(v_errors) = 0,
    'buildings', v_buildings,
    'floors', v_floors,
    'units', v_units,
    'errors', v_errors
  );
end;
$$;
revoke all on function import_property_rows(jsonb, boolean) from public;
grant execute on function import_property_rows(jsonb, boolean) to authenticated;
