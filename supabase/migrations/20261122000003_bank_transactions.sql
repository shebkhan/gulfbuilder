create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  bank_account_id uuid not null references public.bank_accounts(id),
  txn_date date not null,
  description text,
  amount_minor bigint not null,
  matched_type text,
  matched_id uuid,
  imported_at timestamptz not null default now()
);

create index if not exists bank_transactions_org_account_idx on public.bank_transactions (org_id, bank_account_id, txn_date);

alter table public.bank_transactions enable row level security;

create policy bank_transactions_select on public.bank_transactions for select
  using (org_id = auth_org());

create policy bank_transactions_write on public.bank_transactions for all
  using (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'))
  with check (org_id = auth_org());