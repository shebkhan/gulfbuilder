-- 0013_lease_rpcs: generate_lease_charges and activate_lease (M2 Task 5)

-- Mirrors planLeaseCharges (src/lib/lease-schedule.ts) in pure SQL.
create or replace function public.generate_lease_charges(p_lease uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_lease leases;
  v_period_months int;
  v_first_period_end date;
  v_share bigint;
  v_remainder bigint;
  v_cursor date;
  v_guard int := 0;
  v_period_limit date;
  v_period_end date;
  v_index int;
  v_offset int;
  v_next_offset int;
  v_period_start date;
  v_charge_end date;
  v_due_date date;
  v_amount bigint;
  v_inserted_count int := 0;
  v_row_count int;
begin
  select * into v_lease from leases where id = p_lease;
  if not found then
    raise exception 'lease not found' using errcode = '23503';
  end if;

  if auth_role() not in ('org_admin', 'manager') or v_lease.org_id <> auth_org() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  -- shortcut: custom payment schedules are user-entered rows, added with the amendments work after M2.
  if v_lease.payment_frequency = 'custom' then
    raise exception 'custom payment schedules are not supported yet' using errcode = '22023';
  end if;

  v_period_months := case v_lease.payment_frequency
    when 'monthly' then 1
    when 'quarterly' then 3
    when 'semiannual' then 6
    when 'annual' then 12
    else null
  end;

  if v_period_months is null then
    raise exception 'unsupported payment frequency %', v_lease.payment_frequency using errcode = '22023';
  end if;

  if v_lease.end_date <= v_lease.start_date then
    raise exception 'end date must be after start date' using errcode = '22023';
  end if;

  if v_lease.installments < 1 then
    raise exception 'installments must be at least 1' using errcode = '22023';
  end if;

  v_first_period_end := (v_lease.start_date + (v_period_months || ' months')::interval)::date;
  if v_first_period_end > v_lease.end_date then
    raise exception 'lease term is shorter than one payment period' using errcode = '22023';
  end if;

  v_share := v_lease.rent_minor / v_lease.installments;
  v_remainder := v_lease.rent_minor - (v_share * v_lease.installments);
  v_cursor := v_lease.start_date;

  while v_cursor < v_lease.end_date loop
    v_guard := v_guard + 1;
    if v_guard > 1200 then
      raise exception 'lease schedule exceeds 100 years' using errcode = '22023';
    end if;

    v_period_limit := (v_cursor + (v_period_months || ' months')::interval)::date;
    v_period_end := least(v_period_limit, v_lease.end_date);

    for v_index in 0 .. v_lease.installments - 1 loop
      v_offset := floor((v_index * v_period_months)::numeric / v_lease.installments)::int;
      v_next_offset := floor(((v_index + 1) * v_period_months)::numeric / v_lease.installments)::int;
      v_period_start := (v_cursor + (v_offset || ' months')::interval)::date;
      v_charge_end := case
        when v_index = v_lease.installments - 1 then v_period_end
        else least(v_period_end, (v_cursor + (v_next_offset || ' months')::interval)::date)
      end;

      v_due_date := make_date(
        extract(year from v_period_start)::int,
        extract(month from v_period_start)::int,
        least(v_lease.due_day, extract(day from (date_trunc('month', v_period_start) + interval '1 month - 1 day'))::int)
      );

      v_amount := case
        when v_index = v_lease.installments - 1 then v_share + v_remainder
        else v_share
      end;

      insert into charges (
        org_id,
        lease_id,
        type,
        description,
        period_start,
        period_end,
        due_date,
        amount_minor,
        currency,
        paid_minor,
        status,
        created_by
      ) values (
        v_lease.org_id,
        v_lease.id,
        'rent',
        'Rent installment ' || (v_index + 1) || '/' || v_lease.installments,
        v_period_start,
        v_charge_end,
        v_due_date,
        v_amount,
        v_lease.currency,
        0,
        'pending',
        auth.uid()
      )
      on conflict (lease_id, type, period_start) do nothing;

      get diagnostics v_row_count = row_count;
      v_inserted_count := v_inserted_count + v_row_count;
    end loop;

    v_cursor := v_period_end;
  end loop;

  if v_lease.deposit_minor > 0 then
    insert into charges (
      org_id,
      lease_id,
      type,
      description,
      period_start,
      period_end,
      due_date,
      amount_minor,
      currency,
      paid_minor,
      status,
      created_by
    ) values (
      v_lease.org_id,
      v_lease.id,
      'deposit',
      'Security deposit',
      v_lease.start_date,
      v_lease.start_date,
      v_lease.start_date,
      v_lease.deposit_minor,
      v_lease.currency,
      0,
      'pending',
      auth.uid()
    )
    on conflict (lease_id, type, period_start) do nothing;

    get diagnostics v_row_count = row_count;
    v_inserted_count := v_inserted_count + v_row_count;
  end if;

  return v_inserted_count;
end;
$$;

create or replace function public.activate_lease(p_lease uuid)
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

  if v_lease.status <> 'draft' then
    raise exception 'only draft leases can be activated' using errcode = '23514';
  end if;

  if v_lease.end_date <= v_lease.start_date then
    raise exception 'end date must be after start date' using errcode = '23514';
  end if;

  if not exists (select 1 from tenants t where t.id = v_lease.tenant_id and t.org_id = v_lease.org_id) then
    raise exception 'tenant does not belong to the organization' using errcode = '23514';
  end if;

  -- Activate the lease. Triggers enforce_room_vs_unit, enforce_sublet,
  -- exclusion constraints (no_overlap_unit/no_overlap_room), and derive_unit_status.
  update leases
  set status = 'active', updated_at = now()
  where id = p_lease;

  -- Insert initial lease_terms row if absent
  insert into lease_terms (
    org_id,
    lease_id,
    effective_from,
    rent_minor,
    created_by
  ) values (
    v_lease.org_id,
    v_lease.id,
    v_lease.start_date,
    v_lease.rent_minor,
    auth.uid()
  )
  on conflict (lease_id, effective_from) do nothing;

  -- Generate charges schedule
  perform generate_lease_charges(p_lease);
end;
$$;

revoke all on function public.generate_lease_charges(uuid) from public;
grant execute on function public.generate_lease_charges(uuid) to authenticated;

revoke all on function public.activate_lease(uuid) from public;
grant execute on function public.activate_lease(uuid) to authenticated;
