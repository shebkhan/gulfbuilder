-- 0016_finance: Operational finance tables (M3 Step 1)
-- bank_accounts, receipt_sequences, payments, payment_allocations,
-- tenant_credits, cheques, deposits, deposit_transactions, vendors, expenses

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type public.payment_method as enum
      ('cash','bank_transfer','cheque','card','online');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'cheque_status') then
    create type public.cheque_status as enum
      ('received','deposited','cleared','bounced','returned','replaced');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'expense_status') then
    create type public.expense_status as enum
      ('draft','submitted','approved','paid','rejected');
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- bank_accounts
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.bank_accounts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  account_no  text,
  bank_name   text,
  currency    text not null default 'QAR',
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists bank_accounts_org_idx on public.bank_accounts(org_id);

alter table public.bank_accounts enable row level security;

create policy "bank_accounts_select" on public.bank_accounts
  for select to authenticated
  using (org_id = auth_org());

create policy "bank_accounts_write" on public.bank_accounts
  for all to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin','manager'))
  with check (org_id = auth_org() and auth_role() in ('org_admin','manager'));

create trigger trg_bank_accounts_updated_at
  before update on public.bank_accounts
  for each row execute function public.set_updated_at();

create trigger trg_bank_accounts_audit
  after insert or update or delete on public.bank_accounts
  for each row execute function public.audit_trigger();

-- ─────────────────────────────────────────────────────────────────────────────
-- receipt_sequences  (gapless per org+year)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.receipt_sequences (
  org_id   uuid not null references public.organizations(id) on delete cascade,
  year     int  not null,
  last_no  int  not null default 0,
  primary key (org_id, year)
);

alter table public.receipt_sequences enable row level security;

create policy "receipt_sequences_select" on public.receipt_sequences
  for select to authenticated
  using (org_id = auth_org());

-- Only internal (security definer) functions touch this table — no direct DML from app.
create policy "receipt_sequences_deny_write" on public.receipt_sequences
  for all to authenticated
  using (false)
  with check (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- payments
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  tenant_id       uuid not null references public.tenants(id),
  lease_id        uuid references public.leases(id),
  receipt_no      int  not null,
  receipt_year    int  not null,
  amount_minor    bigint not null check (amount_minor > 0),
  currency        text not null default 'QAR',
  method          public.payment_method not null,
  received_at     timestamptz not null,
  reference       text,
  notes           text,
  journal_id      uuid,  -- FK added after journals table created (migration 0017)
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, receipt_year, receipt_no)
);

create index if not exists payments_org_idx    on public.payments(org_id);
create index if not exists payments_tenant_idx on public.payments(tenant_id);
create index if not exists payments_lease_idx  on public.payments(lease_id);

alter table public.payments enable row level security;

create policy "payments_select" on public.payments
  for select to authenticated
  using (org_id = auth_org());

create policy "payments_insert" on public.payments
  for insert to authenticated
  with check (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'));

create policy "payments_deny_update_delete" on public.payments
  for update to authenticated
  using (false);

create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

create trigger trg_payments_audit
  after insert or update or delete on public.payments
  for each row execute function public.audit_trigger();

-- ─────────────────────────────────────────────────────────────────────────────
-- payment_allocations
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.payment_allocations (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references public.payments(id) on delete cascade,
  charge_id    uuid not null references public.charges(id),
  amount_minor bigint not null check (amount_minor > 0),
  created_at   timestamptz not null default now(),
  unique (payment_id, charge_id)
);

create index if not exists payment_allocations_payment_idx on public.payment_allocations(payment_id);
create index if not exists payment_allocations_charge_idx  on public.payment_allocations(charge_id);

alter table public.payment_allocations enable row level security;

create policy "payment_allocations_select" on public.payment_allocations
  for select to authenticated
  using (
    exists (
      select 1 from public.payments p
      where p.id = payment_allocations.payment_id
        and p.org_id = auth_org()
    )
  );

create policy "payment_allocations_insert" on public.payment_allocations
  for insert to authenticated
  with check (
    exists (
      select 1 from public.payments p
      where p.id = payment_allocations.payment_id
        and p.org_id = auth_org()
    )
    and auth_role() in ('org_admin','manager','accountant')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- tenant_credits  (overpayment or manual credit)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.tenant_credits (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  tenant_id       uuid not null references public.tenants(id),
  source_payment_id uuid references public.payments(id),
  amount_minor    bigint not null check (amount_minor > 0),
  remaining_minor bigint not null check (remaining_minor >= 0),
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists tenant_credits_org_tenant_idx on public.tenant_credits(org_id, tenant_id);

alter table public.tenant_credits enable row level security;

create policy "tenant_credits_select" on public.tenant_credits
  for select to authenticated
  using (org_id = auth_org());

create policy "tenant_credits_write" on public.tenant_credits
  for all to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'))
  with check (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'));

create trigger trg_tenant_credits_updated_at
  before update on public.tenant_credits
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- cheques
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.cheques (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  payment_id      uuid references public.payments(id),
  tenant_id       uuid not null references public.tenants(id),
  lease_id        uuid references public.leases(id),
  cheque_no       text not null,
  bank_name       text,
  amount_minor    bigint not null check (amount_minor > 0),
  currency        text not null default 'QAR',
  cheque_date     date not null,
  status          public.cheque_status not null default 'received',
  bounce_reason   text,
  replaced_by     uuid references public.cheques(id),
  bank_account_id uuid references public.bank_accounts(id),
  deposited_at    timestamptz,
  cleared_at      timestamptz,
  notes           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists cheques_org_idx    on public.cheques(org_id);
create index if not exists cheques_tenant_idx on public.cheques(tenant_id);
create index if not exists cheques_status_idx on public.cheques(org_id, status);

alter table public.cheques enable row level security;

create policy "cheques_select" on public.cheques
  for select to authenticated
  using (org_id = auth_org());

create policy "cheques_write" on public.cheques
  for all to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'))
  with check (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'));

create trigger trg_cheques_updated_at
  before update on public.cheques
  for each row execute function public.set_updated_at();

create trigger trg_cheques_audit
  after insert or update or delete on public.cheques
  for each row execute function public.audit_trigger();

-- ─────────────────────────────────────────────────────────────────────────────
-- deposits  (security deposit per lease)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.deposits (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  lease_id         uuid not null references public.leases(id) on delete cascade,
  tenant_id        uuid not null references public.tenants(id),
  amount_minor     bigint not null check (amount_minor >= 0),
  currency         text not null default 'QAR',
  held_minor       bigint not null default 0 check (held_minor >= 0),
  deducted_minor   bigint not null default 0 check (deducted_minor >= 0),
  refunded_minor   bigint not null default 0 check (refunded_minor >= 0),
  received_at      timestamptz,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (lease_id)
);

create index if not exists deposits_org_idx on public.deposits(org_id);

alter table public.deposits enable row level security;

create policy "deposits_select" on public.deposits
  for select to authenticated
  using (org_id = auth_org());

create policy "deposits_write" on public.deposits
  for all to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'))
  with check (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'));

create trigger trg_deposits_updated_at
  before update on public.deposits
  for each row execute function public.set_updated_at();

create trigger trg_deposits_audit
  after insert or update or delete on public.deposits
  for each row execute function public.audit_trigger();

-- ─────────────────────────────────────────────────────────────────────────────
-- deposit_transactions
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.deposit_transactions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  deposit_id      uuid not null references public.deposits(id) on delete cascade,
  kind            text not null check (kind in ('receipt','deduction','refund')),
  amount_minor    bigint not null check (amount_minor > 0),
  charge_id       uuid references public.charges(id),
  reason          text,
  journal_id      uuid,  -- FK added after journals table created
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index if not exists deposit_transactions_deposit_idx on public.deposit_transactions(deposit_id);

alter table public.deposit_transactions enable row level security;

create policy "deposit_transactions_select" on public.deposit_transactions
  for select to authenticated
  using (org_id = auth_org());

create policy "deposit_transactions_insert" on public.deposit_transactions
  for insert to authenticated
  with check (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'));

-- ─────────────────────────────────────────────────────────────────────────────
-- vendors
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.vendors (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  contact     text,
  email       text,
  phone       text,
  category    text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists vendors_org_idx on public.vendors(org_id);

alter table public.vendors enable row level security;

create policy "vendors_select" on public.vendors
  for select to authenticated
  using (org_id = auth_org());

create policy "vendors_write" on public.vendors
  for all to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin','manager'))
  with check (org_id = auth_org() and auth_role() in ('org_admin','manager'));

create trigger trg_vendors_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();

create trigger trg_vendors_audit
  after insert or update or delete on public.vendors
  for each row execute function public.audit_trigger();

-- ─────────────────────────────────────────────────────────────────────────────
-- expenses
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.expenses (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  vendor_id       uuid references public.vendors(id),
  building_id     uuid references public.buildings(id),
  unit_id         uuid references public.units(id),
  category        text not null,
  description     text not null,
  amount_minor    bigint not null check (amount_minor > 0),
  currency        text not null default 'QAR',
  status          public.expense_status not null default 'draft',
  expense_date    date not null,
  paid_at         timestamptz,
  bank_account_id uuid references public.bank_accounts(id),
  journal_id      uuid,  -- FK added after journals table
  notes           text,
  submitted_by    uuid references auth.users(id),
  approved_by     uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists expenses_org_idx    on public.expenses(org_id);
create index if not exists expenses_status_idx on public.expenses(org_id, status);

alter table public.expenses enable row level security;

create policy "expenses_select" on public.expenses
  for select to authenticated
  using (org_id = auth_org());

create policy "expenses_insert" on public.expenses
  for insert to authenticated
  with check (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'));

create policy "expenses_update" on public.expenses
  for update to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'))
  with check (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'));

create trigger trg_expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

create trigger trg_expenses_audit
  after insert or update or delete on public.expenses
  for each row execute function public.audit_trigger();
