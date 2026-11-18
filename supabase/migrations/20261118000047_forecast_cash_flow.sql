-- 0047_forecast_cash_flow: cash flow forecast RPC used by /reports/cash-flow-forecast
-- Returns { inflows: [...], outflows: [...], net: [...], warnings: [...] }
create or replace function public.forecast_cash_flow(
  p_months int default 3,
  p_scenario text default 'base',
  p_building_ids uuid[] default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid := auth_org();
  v_now timestamptz := now();
  v_base_renewal_rate numeric(5,4);
  v_renewal_factor numeric(5,4);
  v_warning_threshold_minor bigint := 50000; -- QAR 500.00
  v_warnings text[] := '{}';
  v_forecast json;
begin
  if v_org_id is null then
    raise exception 'No organization context';
  end if;
  if p_months not in (3, 6, 12) then
    raise exception 'p_months must be 3, 6, or 12';
  end if;
  if p_scenario not in ('base', 'conservative', 'optimistic') then
    raise exception 'p_scenario must be base, conservative, or optimistic';
  end if;

  select coalesce(avg(case when l.status = 'renewed' then 1.0 else 0.0 end), 0.75)
  into v_base_renewal_rate
  from leases l
  join units u on u.id = l.unit_id
  join buildings b on b.id = u.building_id
  where l.org_id = v_org_id
    and l.start_date >= (v_now - '12 months'::interval)::date
    and (p_building_ids is null or b.id = any(p_building_ids));

  v_renewal_factor := case
    when p_scenario = 'base' then 1.0
    when p_scenario = 'conservative' then 0.8
    when p_scenario = 'optimistic' then 1.15
  end;

  with months as (
    select
      g as month_index,
      (v_now + (g || ' months')::interval)::date as month_start,
      (v_now + ((g + 1) || ' months')::interval)::date as month_end
    from generate_series(0, p_months) as g
  ),
  inflow_charges as (
    select m.month_index, coalesce(sum(c.amount_minor), 0) as amount_minor
    from months m
    left join charges c on c.org_id = v_org_id
      and c.due_date >= m.month_start and c.due_date < m.month_end
      and c.status in ('pending', 'partial')
      and (p_building_ids is null or exists (
        select 1 from leases l
        join units u on u.id = l.unit_id
        join buildings b on b.id = u.building_id
        where l.id = c.lease_id and b.id = any(p_building_ids)
      ))
    group by m.month_index
  ),
  inflow_cheques as (
    select m.month_index, coalesce(sum(
      case
        when ch.status = 'received' then ch.amount_minor * 0.85
        when ch.status = 'deposited' then ch.amount_minor * 0.97
        else 0
      end
    ), 0) as amount_minor
    from months m
    left join cheques ch on ch.org_id = v_org_id
      and ch.cheque_date >= m.month_start and ch.cheque_date < m.month_end
      and ch.status in ('received', 'deposited', 'cleared')
      and (p_building_ids is null or exists (
        select 1 from leases l
        join units u on u.id = l.unit_id
        join buildings b on b.id = u.building_id
        where l.id = ch.lease_id and b.id = any(p_building_ids)
      ))
    group by m.month_index
  ),
  outflow_expenses as (
    select m.month_index, coalesce(sum(e.amount_minor), 0) as amount_minor
    from months m
    left join expenses e on e.org_id = v_org_id
      and e.paid_at >= m.month_start and e.paid_at < m.month_end
      and e.status = 'paid'
      and (p_building_ids is null or e.building_id = any(p_building_ids))
    group by m.month_index
  ),
  -- Owner payouts have no building_id and statements carry no building in lines,
  -- so they are included in full when a building filter is passed.
  outflow_payouts as (
    select m.month_index, coalesce(sum(po.amount_minor), 0) as amount_minor
    from months m
    left join owner_payouts po on po.org_id = v_org_id
      and po.paid_on >= m.month_start and po.paid_on < m.month_end
    group by m.month_index
  ),
  all_flows as (
    select
      m.month_index,
      c.amount_minor as charges,
      ch.amount_minor as cheques,
      e.amount_minor as expenses,
      po.amount_minor as payouts,
      c.amount_minor + ch.amount_minor - e.amount_minor - po.amount_minor as net
    from months m
    join inflow_charges c on c.month_index = m.month_index
    join inflow_cheques ch on ch.month_index = m.month_index
    join outflow_expenses e on e.month_index = m.month_index
    join outflow_payouts po on po.month_index = m.month_index
  ),
  warnings as (
    select array_agg(
      format('⚠️ Minimum balance may fall below QAR %s in Month %s', v_warning_threshold_minor / 100.0, month_index)
      order by month_index
    ) as arr
    from all_flows
    where net < v_warning_threshold_minor
  )
  select json_build_object(
    'inflows', (
      select json_agg(json_build_object(
        'month', month_index,
        'charges', charges,
        'cheques', cheques
      ) order by month_index) from all_flows
    ),
    'outflows', (
      select json_agg(json_build_object(
        'month', month_index,
        'expenses', expenses,
        'payouts', payouts
      ) order by month_index) from all_flows
    ),
    'net', (
      select json_agg(json_build_object(
        'month', month_index,
        'amount_minor', net
      ) order by month_index) from all_flows
    ),
    'warnings', (select coalesce(arr, '{}') from warnings)
  ) into v_forecast;

  return v_forecast;
end;
$$;

revoke all on function public.forecast_cash_flow(int, text, uuid[]) from public;
grant execute on function public.forecast_cash_flow(int, text, uuid[]) to authenticated;
