-- 0023_tenant_access: a tenant sees the property they lease.
--
-- The portal shows the unit, its floor and its building, but the property policies only
-- admitted staff and building owners. This migration adds tenant self-access to leases,
-- lease terms, occupants, units, rooms, floors and buildings — and only the rows that
-- belong to the signed-in tenant's own leases.

create or replace function public.tenant_unit_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select l.unit_id
  from public.leases l
  where l.id in (select public.tenant_lease_ids()) and l.unit_id is not null
$$;

create or replace function public.tenant_room_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select l.room_id
  from public.leases l
  where l.id in (select public.tenant_lease_ids()) and l.room_id is not null
$$;

grant execute on function public.tenant_unit_ids() to authenticated;
grant execute on function public.tenant_room_ids() to authenticated;

drop policy if exists leases_select on public.leases;
create policy leases_select on public.leases
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      can_access_lease(unit_id, room_id)
      or tenant_id in (select public.tenant_ids())
    )
  );

drop policy if exists lease_terms_select on public.lease_terms;
create policy lease_terms_select on public.lease_terms
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      can_access_building(public.lease_building_id(lease_id))
      or lease_id in (select public.tenant_lease_ids())
    )
  );

drop policy if exists lease_occupants_select on public.lease_occupants;
create policy lease_occupants_select on public.lease_occupants
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      can_access_building(public.lease_building_id(lease_id))
      or lease_id in (select public.tenant_lease_ids())
    )
  );

drop policy if exists units_select on public.units;
create policy units_select on public.units
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      can_access_building(building_id)
      or id in (select public.tenant_unit_ids())
    )
  );

drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      can_access_building((select u.building_id from public.units u where u.id = rooms.unit_id))
      or id in (select public.tenant_room_ids())
    )
  );

drop policy if exists floors_select on public.floors;
create policy floors_select on public.floors
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      can_access_building(building_id)
      or id in (
        select u.floor_id from public.units u
        where u.id in (select public.tenant_unit_ids())
      )
    )
  );

drop policy if exists buildings_select on public.buildings;
create policy buildings_select on public.buildings
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      can_access_building(id)
      or id in (
        select public.lease_building_id(l.id) from public.leases l
        where l.id in (select public.tenant_lease_ids())
      )
    )
  );
