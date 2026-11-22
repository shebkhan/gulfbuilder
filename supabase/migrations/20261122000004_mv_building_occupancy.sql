-- Materialized view for fast dashboard/report occupancy aggregates.
create materialized view if not exists public.mv_building_occupancy as
select
  b.org_id,
  b.id as building_id,
  b.code as building_code,
  b.name as building_name,
  count(u.id) as total_units,
  count(u.id) filter (where u.status = 'occupied') as occupied_units,
  count(u.id) filter (where u.status = 'vacant') as vacant_units
from public.buildings b
left join public.units u on u.building_id = b.id and u.deleted_at is null
where b.deleted_at is null
group by b.org_id, b.id, b.code, b.name;

create unique index if not exists mv_building_occupancy_pk on public.mv_building_occupancy (building_id);

-- Refresh helper (security definer so service role / cron can call it).
create or replace function public.refresh_building_occupancy_mv()
returns void
language plpgsql
security definer
as $$
begin
  refresh materialized view concurrently public.mv_building_occupancy;
end;
$$;