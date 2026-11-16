-- 0012_lease_policy_fix: two corrections found by the M2 probes.
--
-- 1. `leases_select` called `lease_building_id(id)`, which re-reads `leases`. A row being
--    inserted is not visible to that function's statement snapshot, so `INSERT ... RETURNING`
--    failed with a select-policy violation. The policy now resolves access from the row's own
--    unit_id/room_id, which are already present.
--
-- 2. The exclusion constraints blocked Mode B sub-lets, because a child lease overlaps its
--    parent on the same unit by definition. They now apply to top-level leases only.

create or replace function public.can_access_lease(p_unit uuid, p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select can_access_building(u.building_id) from units u where u.id = p_unit),
    (select can_access_building(u.building_id)
     from rooms r join units u on u.id = r.unit_id
     where r.id = p_room),
    false
  )
$$;

drop policy if exists leases_select on leases;
create policy leases_select on leases for select to authenticated
  using (org_id = auth_org() and can_access_lease(unit_id, room_id));

-- Drop and recreate so the partial predicate includes `parent_lease_id is null`.
alter table leases drop constraint no_overlap_unit;
alter table leases drop constraint no_overlap_room;
alter table leases add constraint no_overlap_unit
  exclude using gist (unit_id with =, daterange(start_date, end_date, '[]') with &&)
  where (unit_id is not null and status = 'active' and parent_lease_id is null);
alter table leases add constraint no_overlap_room
  exclude using gist (room_id with =, daterange(start_date, end_date, '[]') with &&)
  where (room_id is not null and status = 'active' and parent_lease_id is null);
