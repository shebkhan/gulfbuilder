-- 0024_business_rules: overdue sweep, owner statement issue, plan catalogue.
--
-- SPEC §7.1 lists `mark_overdue_and_late_fees` and `issue_owner_statement`; neither
-- shipped with M3/M5. They are business rules, not automation: the functions are callable
-- from the UI and the scheduler that would call them daily is out of scope.

-- ─────────────────────────────────────────────────────────────────────────────
-- plans and subscriptions
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.plans (code, name, limits, features, price_minor, currency)
values
  (
    'trial',
    'Trial',
    '{"units": 50, "users": 5}'::jsonb,
    '{"analytics": true, "owner_portal": true, "tenant_portal": true, "custom_domain": false, "branded_app": false}'::jsonb,
    0,
    'QAR'
  ),
  (
    'standard',
    'Standard',
    '{"units": 500, "users": 25}'::jsonb,
    '{"analytics": true, "owner_portal": true, "tenant_portal": true, "custom_domain": true, "branded_app": false}'::jsonb,
    49900,
    'QAR'
  ),
  (
    'enterprise',
    'Enterprise',
    '{"units": -1, "users": -1}'::jsonb,
    '{"analytics": true, "owner_portal": true, "tenant_portal": true, "custom_domain": true, "branded_app": true}'::jsonb,
    0,
    'QAR'
  )
on conflict (code) do nothing;

insert into public.subscriptions (org_id, plan_code, status)
select o.id, 'trial', 'active'
from public.organizations o
where not exists (select 1 from public.subscriptions s where s.org_id = o.id);

-- An organization without a subscription keeps every feature: the flag gate must not
-- lock a new organization out of its own portal before a plan is chosen.
create or replace function public.org_feature_enabled(p_org uuid, p_feature text) returns boolean
language sql stable security definer set search_path = public as $$
  select
    case
      when not exists (select 1 from public.subscriptions s where s.org_id = p_org) then true
      else exists (
        select 1
        from public.subscriptions s
        join public.plans p on p.code = s.plan_code
        where s.org_id = p_org and p.features ? p_feature
      )
    end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- create_maintenance_request: a tenant may only raise requests on their own lease
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_maintenance_request(
  p_building_id        uuid,
  p_title              text,
  p_description        text    default null,
  p_unit_id            uuid    default null,
  p_room_id            uuid    default null,
  p_tenant_id          uuid    default null,
  p_category           text    default 'general',
  p_priority           public.maint_priority default 'normal',
  p_assigned_vendor_id uuid    default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_id  uuid;
begin
  v_org := auth_org();

  -- Tenants are limited to their own lease; staff may raise anything in the organization.
  if auth_role() = 'tenant' then
    if p_tenant_id is null or p_tenant_id not in (select public.tenant_ids()) then
      raise exception 'Tenant may only raise requests for their own lease.'
        using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.leases l
      where l.id in (select public.tenant_lease_ids())
        and (l.unit_id is not null and l.unit_id = p_unit_id
             or l.room_id is not null and l.room_id = p_room_id)
    ) then
      raise exception 'Tenant may only raise requests for their own lease.'
        using errcode = '42501';
    end if;
  end if;

  insert into public.maintenance_requests (
    org_id, building_id, unit_id, room_id, tenant_id,
    category, priority, status, title, description,
    assigned_vendor_id
  ) values (
    v_org, p_building_id, p_unit_id, p_room_id, p_tenant_id,
    p_category, p_priority, 'open', p_title, p_description,
    p_assigned_vendor_id
  ) returning id into v_id;

  insert into public.maintenance_events (org_id, request_id, kind, body, author_id)
  values (v_org, v_id, 'status_change', 'Request created', auth.uid());

  return v_id;
end;
$$;

revoke all on function public.create_maintenance_request(uuid,text,text,uuid,uuid,uuid,text,public.maint_priority,uuid) from public;
grant execute on function public.create_maintenance_request(uuid,text,text,uuid,uuid,uuid,text,public.maint_priority,uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- mark_overdue_and_late_fees
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.mark_overdue_and_late_fees() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_org      uuid := auth_org();
  v_settings jsonb;
  v_grace    int := 0;
  v_fee_minor bigint := 0;
  v_fee_pct  numeric := 0;
  v_count    int := 0;
  v_row      record;
begin
  if auth_role() not in ('org_admin', 'accountant') then
    raise exception 'Insufficient role to run the overdue sweep.' using errcode = '42501';
  end if;

  select settings into v_settings from public.organizations where id = v_org;
  v_grace     := coalesce((v_settings ->> 'grace_days')::int, 0);
  v_fee_minor := coalesce((v_settings ->> 'late_fee_minor')::bigint, 0);
  v_fee_pct   := coalesce((v_settings ->> 'late_fee_percent')::numeric, 0);

  -- Mark overdue
  with marked as (
    update public.charges c
    set status = 'overdue'
    where c.org_id = v_org
      and c.status in ('pending', 'partial')
      and c.due_date + v_grace < current_date
    returning c.id, c.lease_id, c.amount_minor, c.currency
  )
  select count(*) into v_count from marked;

  -- Late fee, once per charge (the unique key on charges stops a second run adding it)
  if v_fee_minor > 0 or v_fee_pct > 0 then
    for v_row in
      select c.id, c.lease_id, c.amount_minor - c.paid_minor as open_minor, c.currency, c.due_date
      from public.charges c
      where c.org_id = v_org
        and c.status = 'overdue'
        and c.due_date + v_grace < current_date
        and not exists (
          select 1 from public.charges f
          where f.lease_id = c.lease_id and f.type = 'late_fee' and f.period_start = c.due_date
        )
    loop
      insert into public.charges (org_id, lease_id, type, description, period_start, due_date, amount_minor, currency, status)
      values (
        v_org, v_row.lease_id, 'late_fee', 'Late fee', v_row.due_date, current_date,
        case
          when v_fee_pct > 0 then round(v_row.open_minor * v_fee_pct / 100)::bigint
          else v_fee_minor
        end,
        v_row.currency, 'pending'
      );
    end loop;
  end if;

  return v_count;
end;
$$;

revoke all on function public.mark_overdue_and_late_fees() from public;
grant execute on function public.mark_overdue_and_late_fees() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- issue_owner_statement: locks the statement and posts the management fee
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.issue_owner_statement(p_statement_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org     uuid := auth_org();
  v_stmt    public.owner_statements%rowtype;
  v_owner   public.owners%rowtype;
  v_fee     bigint := 0;
  v_journal uuid;
begin
  if auth_role() not in ('org_admin', 'accountant') then
    raise exception 'Insufficient role to issue owner statements.' using errcode = '42501';
  end if;

  select * into v_stmt from public.owner_statements where id = p_statement_id and org_id = v_org;
  if not found then raise exception 'Statement not found.'; end if;
  if v_stmt.status = 'issued' then
    raise exception 'Statement already issued.' using errcode = '23505';
  end if;

  select * into v_owner from public.owners where id = v_stmt.owner_id;

  -- Management fee at issue time (SPEC 7.8): percent of collections, or a fixed amount.
  if v_owner.fee_type = 'percent_of_collections' and v_owner.fee_value > 0 then
    v_fee := round(coalesce((v_stmt.totals ->> 'collections')::numeric, 0) * v_owner.fee_value / 100)::bigint;
  elsif v_owner.fee_type = 'fixed_per_unit' and v_owner.fee_value > 0 then
    v_fee := v_owner.fee_value::bigint * (
      select count(*) from public.units u
      join public.buildings b on b.id = u.building_id
      where b.owner_id = v_owner.id and u.status = 'occupied'
    );
  end if;

  update public.owner_statements s
  set status = 'issued', issued_at = now(), issued_by = auth.uid()
  where s.id = p_statement_id;

  if v_fee > 0 then
    select public.post_journal(
      'owner_statement',
      p_statement_id,
      jsonb_build_array(
        jsonb_build_object('account_code', '2030', 'debit', v_fee, 'credit', 0,
                           'description', 'Management fee'),
        jsonb_build_object('account_code', '4030', 'debit', 0, 'credit', v_fee,
                           'description', 'Management fee')
      ),
      v_stmt.currency,
      'Management fee'
    ) into v_journal;
  end if;

  return p_statement_id;
end;
$$;

revoke all on function public.issue_owner_statement(uuid) from public;
grant execute on function public.issue_owner_statement(uuid) to authenticated;
