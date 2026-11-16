-- 0014_lease_lifecycle: terminate_lease and renew_lease (M2 Task 6)

create or replace function public.terminate_lease(
  p_lease uuid,
  p_date date,
  p_reason text
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_lease leases;
begin
  if auth_role() not in ('org_admin', 'manager') then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select * into v_lease from leases where id = p_lease for update;
  if not found then
    raise exception 'lease not found' using errcode = '23503';
  end if;

  if v_lease.org_id <> auth_org() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  if v_lease.status <> 'active' then
    raise exception 'only active leases can be terminated' using errcode = '23514';
  end if;

  update leases
  set status = 'terminated',
      terminated_at = p_date,
      termination_reason = p_reason,
      updated_at = now()
  where id = p_lease;

  -- Void unpaid future charges, leave paid charges alone
  update charges
  set status = 'void',
      updated_at = now()
  where lease_id = p_lease
    and due_date > p_date
    and paid_minor = 0
    and status <> 'void';
end;
$$;

create or replace function public.renew_lease(
  p_lease uuid,
  p_terms jsonb
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_old leases;
  v_start_date date;
  v_end_date date;
  v_rent_minor bigint;
  v_frequency text;
  v_installments int;
  v_due_day int;
  v_deposit_minor bigint;
  v_lease_no text;
  v_new_id uuid;
begin
  if auth_role() not in ('org_admin', 'manager') then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select * into v_old from leases where id = p_lease for update;
  if not found then
    raise exception 'lease not found' using errcode = '23503';
  end if;

  if v_old.org_id <> auth_org() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  if v_old.status <> 'active' then
    raise exception 'only active leases can be renewed' using errcode = '23514';
  end if;

  v_start_date := coalesce(
    (p_terms->>'start_date')::date,
    (p_terms->>'startDate')::date,
    v_old.end_date
  );

  v_end_date := coalesce(
    (p_terms->>'end_date')::date,
    (p_terms->>'endDate')::date
  );
  if v_end_date is null or v_end_date <= v_start_date then
    raise exception 'invalid end date for renewed lease' using errcode = '22023';
  end if;

  v_rent_minor := coalesce(
    (p_terms->>'rent_minor')::bigint,
    (p_terms->>'rentMinor')::bigint,
    v_old.rent_minor
  );

  v_frequency := coalesce(
    p_terms->>'payment_frequency',
    p_terms->>'paymentFrequency',
    v_old.payment_frequency
  );

  v_installments := coalesce(
    (p_terms->>'installments')::int,
    v_old.installments
  );

  v_due_day := coalesce(
    (p_terms->>'due_day')::int,
    (p_terms->>'dueDay')::int,
    v_old.due_day
  );

  v_deposit_minor := coalesce(
    (p_terms->>'deposit_minor')::bigint,
    (p_terms->>'depositMinor')::bigint,
    0::bigint
  );

  v_lease_no := coalesce(
    p_terms->>'lease_no',
    p_terms->>'leaseNo',
    v_old.lease_no || '-R' || to_char(now(), 'YYMMDDHH24MISS')
  );

  insert into leases (
    org_id,
    lease_no,
    unit_id,
    room_id,
    tenant_id,
    start_date,
    end_date,
    rent_minor,
    currency,
    payment_frequency,
    installments,
    due_day,
    deposit_minor,
    rent_collected_by,
    notice_days,
    status,
    created_by
  ) values (
    v_old.org_id,
    v_lease_no,
    v_old.unit_id,
    v_old.room_id,
    v_old.tenant_id,
    v_start_date,
    v_end_date,
    v_rent_minor,
    v_old.currency,
    v_frequency,
    v_installments,
    v_due_day,
    v_deposit_minor,
    v_old.rent_collected_by,
    v_old.notice_days,
    'draft',
    auth.uid()
  )
  returning id into v_new_id;

  if v_start_date = v_old.end_date then
    update leases
    set status = 'renewed', updated_at = now()
    where id = p_lease;
  end if;

  return v_new_id;
end;
$$;

revoke all on function public.terminate_lease(uuid, date, text) from public;
grant execute on function public.terminate_lease(uuid, date, text) to authenticated;

revoke all on function public.renew_lease(uuid, jsonb) from public;
grant execute on function public.renew_lease(uuid, jsonb) to authenticated;
