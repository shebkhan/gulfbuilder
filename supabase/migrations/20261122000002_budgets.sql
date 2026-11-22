-- Budgets: per-organization, per-building, per-account, per-month budget amounts.
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  building_id uuid references public.buildings(id),
  account_id uuid not null references public.accounts(id),
  month date not null,
  amount_minor bigint not null,
  currency char(3) not null references public.currencies(code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (org_id, building_id, account_id, month)
);

create index budgets_org_month_idx on public.budgets (org_id, month);
create index budgets_org_building_idx on public.budgets (org_id, building_id);

alter table public.budgets enable row level security;

create policy budgets_org_read on public.budgets for select
  using (org_id = auth_org());

create policy budgets_org_write on public.budgets for all
  using (org_id = auth_org() and auth_role() in ('org_admin','manager','accountant'))
  with check (org_id = auth_org());

create trigger budgets_set_updated_at before update on public.budgets
  for each row execute function set_updated_at();