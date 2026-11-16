-- 0015_lease_expiry: leases_expiring function (M2 Task 9)

create or replace function public.leases_expiring(p_days int default 30)
returns table (
  lease_id uuid,
  lease_no text,
  tenant_name text,
  end_date date,
  days_left int
)
language sql stable security definer set search_path = public as $$
  select
    l.id as lease_id,
    l.lease_no,
    t.full_name as tenant_name,
    l.end_date,
    (l.end_date - current_date)::int as days_left
  from leases l
  join tenants t on t.id = l.tenant_id
  where l.org_id = auth_org()
    and l.status = 'active'
    and can_access_lease(l.unit_id, l.room_id)
    and l.end_date >= current_date
    and l.end_date <= (current_date + (p_days || ' days')::interval)::date
  order by l.end_date asc;
$$;

revoke all on function public.leases_expiring(int) from public;
grant execute on function public.leases_expiring(int) to authenticated;

