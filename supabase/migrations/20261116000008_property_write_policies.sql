-- 0008_property_write_policies: a `for all` policy applies to SELECT too, and
-- permissive policies are OR'ed. `units_write` therefore let any manager read every
-- unit in the org, bypassing the building scope in `units_select`. Splitting the
-- write policies per command keeps SELECT governed only by the scoped select policy.

drop policy if exists floors_write on floors;
create policy floors_insert on floors for insert to authenticated
  with check (org_id = auth_org() and auth_role() in ('org_admin', 'manager'));
create policy floors_update on floors for update to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager'))
  with check (org_id = auth_org());
create policy floors_delete on floors for delete to authenticated
  using (org_id = auth_org() and auth_role() = 'org_admin');

drop policy if exists units_write on units;
create policy units_insert on units for insert to authenticated
  with check (org_id = auth_org() and auth_role() in ('org_admin', 'manager'));
create policy units_update on units for update to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager'))
  with check (org_id = auth_org());
create policy units_delete on units for delete to authenticated
  using (org_id = auth_org() and auth_role() = 'org_admin');

drop policy if exists rooms_write on rooms;
create policy rooms_insert on rooms for insert to authenticated
  with check (org_id = auth_org() and auth_role() in ('org_admin', 'manager'));
create policy rooms_update on rooms for update to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager'))
  with check (org_id = auth_org());
create policy rooms_delete on rooms for delete to authenticated
  using (org_id = auth_org() and auth_role() = 'org_admin');
