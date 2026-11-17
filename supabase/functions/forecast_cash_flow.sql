-- supabase/functions/forecast_cash_flow.sql
-- Forecast cash flow for next N months under base/conservative/optimistic scenarios
-- Returns JSON: { "inflows": [...], "outflows": [...], "net": [...], "warnings": [...] }
-- Caller must be authenticated and have org access (RLS enforced)
create or replace function forecast_cash_flow(
  p_months int default 3,
  p_scenario text default 'base',
  p_building_ids uuid[] default null
) returns json language plpgsql security definer as $$
declare
  v_org_id uuid := auth.org_id();
  v_now timestamptz := now();
  v_end_date date;
  v_base_renewal_rate numeric(5,4);
  v_renewal_factor numeric(5,4);
  v_warning_threshold_minor bigint := 50000; -- QAR 500.00
  v_warnings text[] := '{}';
  v_forecast json;
begin
  -- Validate inputs
  if p_months not in (3, 6, 12) then
    raise exception 'p_months must be 3, 6, or 12';
  end if;
  if p_scenario not in ('base', 'conservative', 'optimistic') then
    raise exception 'p_scenario must be base, conservative, or optimistic';
  end if;

  -- Compute forecast end date
  v_end_date := (v_now + (p_months || ' months')::interval)::date;

  -- Get base renewal rate for this org (from historical leases)
  select coalesce(avg(case when l.status = 'renewed' then 1.0 else 0.0 end), 0.75)
  into v_base_renewal_rate
  from leases l
  join units u on u.id = l.unit_id
  join buildings b on b.id = u.building_id
  where l.org_id = v_org_id
    and l.start_date >= (v_now - '12 months'::interval)::date
    and (p_building_ids is null or b.id = any(p_building_ids));

  -- Apply scenario factor
  v_renewal_factor := case
    when p_scenario = 'base' then 1.0
    when p_scenario = 'conservative' then 0.8
    when p_scenario = 'optimistic' then 1.15
  end;

  -- Generate monthly buckets: [month_0, month_1, ..., month_n]
  -- month_0 = current month (partial), month_1 = next full month, etc.
  with months as (
    select generate_series(0, p_months, 1) as i,
           (v_now + (generate_series(0, p_months, 1) || ' months')::interval)::date as month_start,
           (v_now + ((generate_series(0, p_months, 1) + 1) || ' months')::interval)::date as month_end
  ),
  -- Inflows: scheduled charges (rent, late fees)
  inflow_charges as (
    select
      m.i as month_index,
      coalesce(sum(c.amount_minor), 0) as amount_minor,
      c.currency
    from months m
    left join charges c on c.org_id = v_org_id
      and c.due_date >= m.month_start
      and c.due_date < m.month_end
      and c.status in ('pending', 'partial')
      and (p_building_ids is null or exists (
        select 1 from leases l
        join units u on u.id = l.unit_id
        join buildings b on b.id = u.building_id
        where l.id = c.lease_id and b.id = any(p_building_ids)
      ))
    group by m.i, c.currency
  ),
  -- Inflows: cheques expected to clear (based on status & Gulf clearing patterns)
  inflow_cheques as (
    select
      m.i as month_index,
      coalesce(sum(
        case
          when ch.status = 'received' then ch.amount_minor * 0.85
          when ch.status = 'deposited' then ch.amount_minor * 0.97
          else 0
        end
      ), 0) as amount_minor,
      ch.currency
    from months m
    left join cheques ch on ch.org_id = v_org_id
      and ch.due_date >= m.month_start
      and ch.due_date < m.month_end
      and ch.status in ('received', 'deposited', 'cleared')
      and (p_building_ids is null or exists (
        select 1 from leases l
        join units u on u.id = l.unit_id
        join buildings b on b.id = u.building_id
        where l.id = ch.lease_id and b.id = any(p_building_ids)
      ))
    group by m.i, ch.currency
  ),
  -- Outflows: paid expenses
  outflow_expenses as (
    select
      m.i as month_index,
      coalesce(sum(e.amount_minor), 0) as amount_minor,
      e.currency
    from months m
    left join expenses e on e.org_id = v_org_id
      and e.paid_on >= m.month_start
      and e.paid_on < m.month_end
      and e.status = 'paid'
      and (p_building_ids is null or e.building_id = any(p_building_ids))
    group by m.i, e.currency
  ),
  -- Outflows: owner payouts
  outflow_payouts as (
    select
      m.i as month_index,
      coalesce(sum(p.amount_minor), 0) as amount_minor,
      p.currency
    from months m
    left join owner_payouts p on p.org_id = v_org_id
      and p.paid_on >= m.month_start
      and p.paid_on < m.month_end
      and (p_building_ids is null or exists (
        select 1 from owner_statements s
        join leases l on l.id = s.id
        join units u on u.id = l.unit_id
        join buildings b on b.id = u.building_id
        where s.id = p.statement_id and b.id = any(p_building_ids)
      ))
    group by m.i, p.currency
  ),
  -- Combine all flows per month/currency
  all_flows as (
    select
      i.month_index,
      i.currency,
      coalesce(i.amount_minor, 0) as inflow_charges,
      coalesce(c.amount_minor, 0) as inflow_cheques,
      coalesce(e.amount_minor, 0) as outflow_expenses,
      coalesce(p.amount_minor, 0) as outflow_payouts,
      coalesce(i.amount_minor, 0) + coalesce(c.amount_minor, 0) - coalesce(e.amount_minor, 0) - coalesce(p.amount_minor, 0) as net
    from months i
    left join inflow_charges i on i.month_index = i.i and i.currency = i.currency
    left join inflow_cheques c on c.month_index = i.i and c.currency = i.currency
    left join outflow_expenses e on e.month_index = i.i and e.currency = i.currency
    left join outflow_payouts p on p.month_index = i.i and p.currency = i.currency
  ),
  -- Aggregate to single currency (QAR) using fx_rates if needed (stubbed for now)
  aggregated as (
    select
      month_index,
      sum(inflow_charges) as inflow_charges_qar,
      sum(inflow_cheques) as inflow_cheques_qar,
      sum(outflow_expenses) as outflow_expenses_qar,
      sum(outflow_payouts) as outflow_payouts_qar,
      sum(net) as net_qar
    from all_flows
    group by month_index
  ),
  -- Generate warnings
  warnings as (
    select array_agg(
      case
        when net_qar < v_warning_threshold_minor then
          format('⚠️ Minimum balance may fall below QAR %s in Month %s', v_warning_threshold_minor / 100.0, month_index)
      end
    ) filter (where net_qar < v_warning_threshold_minor) as arr
    from aggregated
  )
  select json_build_object(
    'inflows', (
      select json_agg(
        json_build_object(
          'month', month_index,
          'charges', inflow_charges_qar,
          'cheques', inflow_cheques_qar
        )
      )
      from aggregated
      order by month_index
    ),
    'outflows', (
      select json_agg(
        json_build_object(
          'month', month_index,
          'expenses', outflow_expenses_qar,
          'payouts', outflow_payouts_qar
        )
      )
      from aggregated
      order by month_index
    ),
    'net', (
      select json_agg(
        json_build_object(
          'month', month_index,
          'amount_minor', net_qar
        )
      )
      from aggregated
      order by month_index
    ),
    'warnings', (
      select coalesce(arr, '{}')
      from warnings
    )
  ) into v_forecast;

  return v_forecast;
end;
$$;