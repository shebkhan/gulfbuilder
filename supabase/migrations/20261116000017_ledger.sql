-- 0017_ledger: Double-entry ledger, chart of accounts, accounting periods (M3 Step 2)

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'account_type') then
    create type public.account_type as enum
      ('asset','liability','equity','revenue','expense');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'period_status') then
    create type public.period_status as enum ('open','closed');
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- accounts  (chart of accounts)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  code        text not null,
  name        text not null,
  type        public.account_type not null,
  parent_id   uuid references public.accounts(id),
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (org_id, code)
);

create index if not exists accounts_org_idx on public.accounts(org_id);

alter table public.accounts enable row level security;

create policy "accounts_select" on public.accounts
  for select to authenticated
  using (org_id = auth_org());

create policy "accounts_write" on public.accounts
  for all to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'))
  with check (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'));

-- ─────────────────────────────────────────────────────────────────────────────
-- accounting_periods
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.accounting_periods (
  org_id    uuid not null references public.organizations(id) on delete cascade,
  month     date not null,  -- always first-of-month; e.g. 2026-11-01
  status    public.period_status not null default 'open',
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  primary key (org_id, month)
);

create index if not exists accounting_periods_org_idx on public.accounting_periods(org_id);

alter table public.accounting_periods enable row level security;

create policy "accounting_periods_select" on public.accounting_periods
  for select to authenticated
  using (org_id = auth_org());

create policy "accounting_periods_write" on public.accounting_periods
  for all to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin','accountant'))
  with check (org_id = auth_org() and auth_role() in ('org_admin','accountant'));

-- ─────────────────────────────────────────────────────────────────────────────
-- journals  (immutable header)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.journals (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  source_type  text not null,  -- 'payment','deposit','expense','manual','reversal'
  source_id    uuid,
  reversal_of  uuid references public.journals(id),
  currency     text not null default 'QAR',
  memo         text,
  posted_at    timestamptz not null default now(),
  posted_by    uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists journals_org_idx    on public.journals(org_id);
create index if not exists journals_source_idx on public.journals(org_id, source_type, source_id);

alter table public.journals enable row level security;

create policy "journals_select" on public.journals
  for select to authenticated
  using (org_id = auth_org());

create policy "journals_insert" on public.journals
  for insert to authenticated
  with check (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'));

-- journals are immutable: no UPDATE or DELETE
create policy "journals_deny_update" on public.journals
  for update to authenticated
  using (false);

create policy "journals_deny_delete" on public.journals
  for delete to authenticated
  using (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- journal_lines
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.journal_lines (
  id           uuid primary key default gen_random_uuid(),
  journal_id   uuid not null references public.journals(id) on delete cascade,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  account_id   uuid not null references public.accounts(id),
  debit_minor  bigint not null default 0 check (debit_minor  >= 0),
  credit_minor bigint not null default 0 check (credit_minor >= 0),
  -- at least one side must be non-zero, and not both
  constraint one_side_nonzero check (
    (debit_minor > 0 and credit_minor = 0) or
    (credit_minor > 0 and debit_minor = 0)
  ),
  -- dimensions for reporting
  tenant_id    uuid references public.tenants(id),
  lease_id     uuid references public.leases(id),
  building_id  uuid references public.buildings(id),
  unit_id      uuid references public.units(id),
  description  text,
  created_at   timestamptz not null default now()
);

create index if not exists journal_lines_journal_idx on public.journal_lines(journal_id);
create index if not exists journal_lines_account_idx on public.journal_lines(org_id, account_id);

alter table public.journal_lines enable row level security;

create policy "journal_lines_select" on public.journal_lines
  for select to authenticated
  using (org_id = auth_org());

create policy "journal_lines_insert" on public.journal_lines
  for insert to authenticated
  with check (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'));

-- journal_lines are immutable: no UPDATE or DELETE
create policy "journal_lines_deny_update" on public.journal_lines
  for update to authenticated
  using (false);

create policy "journal_lines_deny_delete" on public.journal_lines
  for delete to authenticated
  using (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- owner_ledger_entries  (managed-owner statements)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.owner_ledger_entries (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  building_id     uuid not null references public.buildings(id),
  journal_id      uuid references public.journals(id),
  kind            text not null check (kind in ('collection','expense','management_fee','payout')),
  amount_minor    bigint not null,
  currency        text not null default 'QAR',
  description     text,
  entry_date      date not null,
  created_at      timestamptz not null default now()
);

create index if not exists owner_ledger_entries_org_idx      on public.owner_ledger_entries(org_id);
create index if not exists owner_ledger_entries_building_idx on public.owner_ledger_entries(building_id);

alter table public.owner_ledger_entries enable row level security;

create policy "owner_ledger_entries_select" on public.owner_ledger_entries
  for select to authenticated
  using (org_id = auth_org());

create policy "owner_ledger_entries_write" on public.owner_ledger_entries
  for all to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'))
  with check (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'));

-- ─────────────────────────────────────────────────────────────────────────────
-- Now that journals table exists, add FK from payments, deposit_transactions, expenses
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.payments
  add constraint payments_journal_id_fk
    foreign key (journal_id) references public.journals(id);

alter table public.deposit_transactions
  add constraint deposit_transactions_journal_id_fk
    foreign key (journal_id) references public.journals(id);

alter table public.expenses
  add constraint expenses_journal_id_fk
    foreign key (journal_id) references public.journals(id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Triggers: immutability enforcement at DB level
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.block_journal_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Journals and journal lines are immutable. Post a reversal to correct.';
end;
$$;

create trigger trg_block_journals_update
  before update on public.journals
  for each row execute function public.block_journal_mutation();

create trigger trg_block_journals_delete
  before delete on public.journals
  for each row execute function public.block_journal_mutation();

create trigger trg_block_journal_lines_update
  before update on public.journal_lines
  for each row execute function public.block_journal_mutation();

create trigger trg_block_journal_lines_delete
  before delete on public.journal_lines
  for each row execute function public.block_journal_mutation();

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: enforce posting into open periods
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_period_open()
returns trigger language plpgsql as $$
declare
  v_month date;
  v_status public.period_status;
begin
  v_month := date_trunc('month', new.posted_at)::date;
  select status into v_status
  from public.accounting_periods
  where org_id = new.org_id and month = v_month;

  -- If period row doesn't exist, it's implicitly open (auto-create on first posting)
  if v_status is null then
    insert into public.accounting_periods (org_id, month, status)
    values (new.org_id, v_month, 'open')
    on conflict do nothing;
    return new;
  end if;

  if v_status = 'closed' then
    raise exception 'Cannot post to a closed accounting period (%).', v_month;
  end if;

  return new;
end;
$$;

create trigger trg_enforce_period_open
  before insert on public.journals
  for each row execute function public.enforce_period_open();

-- ─────────────────────────────────────────────────────────────────────────────
-- Chart of accounts seed function
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.seed_chart_of_accounts(p_org uuid)
returns void language plpgsql as $$
begin
  -- Assets
  insert into public.accounts (org_id, code, name, type, is_system) values
    (p_org, '1000', 'Cash and Bank',               'asset',   true),
    (p_org, '1010', 'Petty Cash',                  'asset',   true),
    (p_org, '1020', 'Bank Account - Main',          'asset',   true),
    (p_org, '1100', 'Accounts Receivable',          'asset',   true),
    (p_org, '1110', 'Tenant Receivables',           'asset',   true),
    (p_org, '1120', 'Security Deposits Held',       'asset',   true),
    (p_org, '1200', 'Prepaid Expenses',             'asset',   true)
  on conflict (org_id, code) do nothing;

  -- Liabilities
  insert into public.accounts (org_id, code, name, type, is_system) values
    (p_org, '2000', 'Accounts Payable',             'liability', true),
    (p_org, '2010', 'Tenant Advance Payments',      'liability', true),
    (p_org, '2020', 'Security Deposits Payable',    'liability', true),
    (p_org, '2100', 'VAT Payable',                  'liability', true)
  on conflict (org_id, code) do nothing;

  -- Equity
  insert into public.accounts (org_id, code, name, type, is_system) values
    (p_org, '3000', 'Owner Equity',                 'equity', true),
    (p_org, '3100', 'Retained Earnings',            'equity', true)
  on conflict (org_id, code) do nothing;

  -- Revenue
  insert into public.accounts (org_id, code, name, type, is_system) values
    (p_org, '4000', 'Rental Revenue',               'revenue', true),
    (p_org, '4010', 'Residential Rent',             'revenue', true),
    (p_org, '4020', 'Commercial Rent',              'revenue', true),
    (p_org, '4100', 'Other Income',                 'revenue', true),
    (p_org, '4110', 'Late Payment Fees',            'revenue', true),
    (p_org, '4120', 'Management Fee Income',        'revenue', true)
  on conflict (org_id, code) do nothing;

  -- Expenses
  insert into public.accounts (org_id, code, name, type, is_system) values
    (p_org, '5000', 'Operating Expenses',           'expense', true),
    (p_org, '5010', 'Maintenance and Repairs',      'expense', true),
    (p_org, '5020', 'Utilities',                    'expense', true),
    (p_org, '5030', 'Insurance',                    'expense', true),
    (p_org, '5040', 'Management Fees Paid',         'expense', true),
    (p_org, '5050', 'General and Administrative',   'expense', true)
  on conflict (org_id, code) do nothing;
end;
$$;

-- Seed for existing orgs
do $$
declare
  v_org uuid;
begin
  for v_org in select id from public.organizations loop
    perform public.seed_chart_of_accounts(v_org);
  end loop;
end $$;

