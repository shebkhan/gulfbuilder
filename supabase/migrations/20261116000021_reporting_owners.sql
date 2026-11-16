-- 0021_reporting_owners: Owner statements, payouts, approvals, reports & KPI functions (M5)

-- ─────────────────────────────────────────────────────────────────────────────
-- owner_statements
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.owner_statements (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  owner_id      uuid not null references public.owners(id) on delete cascade,
  period_start  date not null,
  period_end    date not null,
  currency      text not null default 'QAR',
  status        text not null default 'draft' check (status in ('draft', 'review', 'issued')),
  opening_minor bigint not null default 0,
  closing_minor bigint not null default 0,
  totals        jsonb not null default '{}',
  lines         jsonb not null default '[]',
  pdf_path      text,
  issued_at     timestamptz,
  issued_by     uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner_id, period_start, currency)
);

create index if not exists owner_statements_org_idx on public.owner_statements(org_id);
create index if not exists owner_statements_owner_idx on public.owner_statements(owner_id);

alter table public.owner_statements enable row level security;

create policy "owner_statements_select" on public.owner_statements
  for select to authenticated
  using (org_id = auth_org());

create policy "owner_statements_write" on public.owner_statements
  for all to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'accountant'))
  with check (org_id = auth_org() and auth_role() in ('org_admin', 'accountant'));

create trigger trg_owner_statements_updated_at
  before update on public.owner_statements
  for each row execute function public.set_updated_at();

create trigger trg_owner_statements_audit
  after insert or update or delete on public.owner_statements
  for each row execute function public.audit_trigger();

-- ─────────────────────────────────────────────────────────────────────────────
-- owner_payouts
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.owner_payouts (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  owner_id        uuid not null references public.owners(id) on delete cascade,
  statement_id    uuid references public.owner_statements(id),
  amount_minor    bigint not null check (amount_minor > 0),
  currency        text not null default 'QAR',
  paid_on         date not null default current_date,
  method          text not null default 'bank_transfer',
  reference       text,
  bank_account_id uuid references public.bank_accounts(id),
  journal_id      uuid references public.journals(id),
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index if not exists owner_payouts_org_idx   on public.owner_payouts(org_id);
create index if not exists owner_payouts_owner_idx on public.owner_payouts(owner_id);

alter table public.owner_payouts enable row level security;

create policy "owner_payouts_select" on public.owner_payouts
  for select to authenticated
  using (org_id = auth_org());

create policy "owner_payouts_insert" on public.owner_payouts
  for insert to authenticated
  with check (org_id = auth_org() and auth_role() in ('org_admin', 'accountant'));

-- ─────────────────────────────────────────────────────────────────────────────
-- owner_expense_approvals
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.owner_expense_approvals (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  expense_id   uuid not null references public.expenses(id) on delete cascade,
  owner_id     uuid not null references public.owners(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid references auth.users(id),
  note         text,
  unique (expense_id, owner_id)
);

create index if not exists owner_expense_approvals_org_idx on public.owner_expense_approvals(org_id);

alter table public.owner_expense_approvals enable row level security;

create policy "owner_expense_approvals_select" on public.owner_expense_approvals
  for select to authenticated
  using (org_id = auth_org());

create policy "owner_expense_approvals_write" on public.owner_expense_approvals
  for all to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager', 'owner'))
  with check (org_id = auth_org() and auth_role() in ('org_admin', 'manager', 'owner'));

-- ─────────────────────────────────────────────────────────────────────────────
-- report_definitions & report_snapshots
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.report_definitions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid references auth.users(id),
  name          text not null,
  report_key    text not null,
  params        jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

create table if not exists public.report_snapshots (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  report_key   text not null,
  period_start date,
  period_end   date,
  params       jsonb,
  payload      jsonb,
  pdf_path     text,
  created_at   timestamptz not null default now()
);

alter table public.report_definitions enable row level security;
alter table public.report_snapshots enable row level security;

create policy "report_definitions_select" on public.report_definitions
  for select to authenticated using (org_id = auth_org());

create policy "report_snapshots_select" on public.report_snapshots
  for select to authenticated using (org_id = auth_org());

create policy "report_snapshots_insert" on public.report_snapshots
  for insert to authenticated with check (org_id = auth_org());

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: generate_owner_statement
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.generate_owner_statement(
  p_owner_id     uuid,
  p_period_start date,
  p_period_end   date,
  p_currency     text default 'QAR'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org         uuid;
  v_owner       public.owners%rowtype;
  v_id          uuid;
  v_collections bigint := 0;
  v_expenses    bigint := 0;
  v_mgmt_fee    bigint := 0;
  v_net         bigint := 0;
  v_totals      jsonb;
begin
  v_org := auth_org();

  if auth_role() not in ('org_admin', 'accountant') then
    raise exception 'Insufficient role to generate owner statements.';
  end if;

  select * into v_owner from public.owners where id = p_owner_id and org_id = v_org;
  if not found then raise exception 'Owner not found.'; end if;

  -- Aggregate from owner_ledger_entries
  select
    coalesce(sum(case when kind = 'collection' then amount_minor else 0 end), 0),
    coalesce(sum(case when kind = 'expense' then amount_minor else 0 end), 0),
    coalesce(sum(case when kind = 'management_fee' then amount_minor else 0 end), 0)
  into v_collections, v_expenses, v_mgmt_fee
  from public.owner_ledger_entries
  where org_id = v_org
    and building_id in (select id from public.buildings where owner_id = p_owner_id)
    and entry_date >= p_period_start and entry_date <= p_period_end;

  -- If no owner ledger entries exist yet, compute collections from payments on owner's leases
  if v_collections = 0 then
    select coalesce(sum(p.amount_minor), 0) into v_collections
    from public.payments p
    join public.leases l on l.id = p.lease_id
    join public.units u on u.id = l.unit_id
    join public.buildings b on b.id = u.building_id
    where p.org_id = v_org and b.owner_id = p_owner_id
      and p.received_at::date >= p_period_start and p.received_at::date <= p_period_end;

    -- Compute management fee based on owner fee_value (percentage)
    if v_owner.fee_value > 0 then
      v_mgmt_fee := round(v_collections * (v_owner.fee_value / 100.0));
    end if;

    -- Compute expenses for owner's buildings
    select coalesce(sum(e.amount_minor), 0) into v_expenses
    from public.expenses e
    where e.org_id = v_org
      and e.building_id in (select id from public.buildings where owner_id = p_owner_id)
      and e.status = 'paid'
      and e.expense_date >= p_period_start and e.expense_date <= p_period_end;
  end if;

  v_net := v_collections - v_expenses - v_mgmt_fee;

  v_totals := jsonb_build_object(
    'collections', v_collections,
    'expenses', v_expenses,
    'management_fee', v_mgmt_fee,
    'net_payable', v_net
  );

  insert into public.owner_statements (
    org_id, owner_id, period_start, period_end, currency,
    status, opening_minor, closing_minor, totals, lines,
    issued_by
  ) values (
    v_org, p_owner_id, p_period_start, p_period_end, p_currency,
    'draft', 0, v_net, v_totals, '[]'::jsonb,
    auth.uid()
  )
  on conflict (owner_id, period_start, currency)
  do update set
    period_end = p_period_end,
    closing_minor = v_net,
    totals = v_totals,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.generate_owner_statement(uuid,date,date,text) from public;
grant execute on function public.generate_owner_statement(uuid,date,date,text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: record_owner_payout
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.record_owner_payout(
  p_owner_id        uuid,
  p_amount          bigint,
  p_currency        text    default 'QAR',
  p_statement_id    uuid    default null,
  p_paid_on         date    default current_date,
  p_method          text    default 'bank_transfer',
  p_reference       text    default null,
  p_bank_account_id uuid    default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_id  uuid;
  v_jid uuid;
begin
  v_org := auth_org();

  if auth_role() not in ('org_admin', 'accountant') then
    raise exception 'Insufficient role to record owner payouts.';
  end if;

  if p_amount <= 0 then raise exception 'Payout amount must be positive.'; end if;

  -- Post double-entry journal: DR Owner Equity (3000) / CR Bank (1020)
  v_jid := public.post_journal(
    'payout',
    null,
    jsonb_build_array(
      jsonb_build_object('account_code','3000','debit', p_amount,  'description','Owner distribution payout'),
      jsonb_build_object('account_code','1020','credit',p_amount,  'description','Bank disbursement')
    ),
    p_currency,
    'Owner payout: ' || coalesce(p_reference, '')
  );

  insert into public.owner_payouts (
    org_id, owner_id, statement_id, amount_minor, currency,
    paid_on, method, reference, bank_account_id, journal_id, created_by
  ) values (
    v_org, p_owner_id, p_statement_id, p_amount, p_currency,
    p_paid_on, p_method, p_reference, p_bank_account_id, v_jid, auth.uid()
  ) returning id into v_id;

  update public.journals set source_id = v_id where id = v_jid;

  -- If tied to a statement, update statement status to issued
  if p_statement_id is not null then
    update public.owner_statements
    set status = 'issued', issued_at = now(), issued_by = auth.uid()
    where id = p_statement_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.record_owner_payout(uuid,bigint,text,uuid,date,text,text,uuid) from public;
grant execute on function public.record_owner_payout(uuid,bigint,text,uuid,date,text,text,uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: get_portfolio_kpis
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_portfolio_kpis()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_org          uuid;
  v_total_units  int := 0;
  v_occupied     int := 0;
  v_vacant       int := 0;
  v_occupancy_pct numeric := 0;
  v_total_rent   bigint := 0;
  v_ytd_collected bigint := 0;
  v_ytd_expenses bigint := 0;
  v_overdue_minor bigint := 0;
begin
  v_org := auth_org();

  -- Unit counts
  select
    count(*),
    count(*) filter (where status = 'occupied'),
    count(*) filter (where status = 'vacant')
  into v_total_units, v_occupied, v_vacant
  from public.units
  where org_id = v_org;

  if v_total_units > 0 then
    v_occupancy_pct := round((v_occupied::numeric / v_total_units::numeric) * 100, 1);
  end if;

  -- Active rent roll
  select coalesce(sum(rent_minor), 0) into v_total_rent
  from public.leases
  where org_id = v_org and status = 'active';

  -- YTD Collections
  select coalesce(sum(amount_minor), 0) into v_ytd_collected
  from public.payments
  where org_id = v_org
    and extract(year from received_at) = extract(year from now());

  -- YTD Expenses
  select coalesce(sum(amount_minor), 0) into v_ytd_expenses
  from public.expenses
  where org_id = v_org
    and status = 'paid'
    and extract(year from expense_date) = extract(year from now());

  -- Overdue charges
  select coalesce(sum(amount_minor - paid_minor), 0) into v_overdue_minor
  from public.charges
  where org_id = v_org and status = 'overdue';

  return jsonb_build_object(
    'total_units', v_total_units,
    'occupied_units', v_occupied,
    'vacant_units', v_vacant,
    'occupancy_pct', v_occupancy_pct,
    'monthly_rent_roll', v_total_rent,
    'ytd_collections', v_ytd_collected,
    'ytd_expenses', v_ytd_expenses,
    'net_operating_income', v_ytd_collected - v_ytd_expenses,
    'overdue_receivables', v_overdue_minor
  );
end;
$$;

revoke all on function public.get_portfolio_kpis() from public;
grant execute on function public.get_portfolio_kpis() to authenticated;
