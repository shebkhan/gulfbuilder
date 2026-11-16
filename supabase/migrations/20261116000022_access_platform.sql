-- 0022_access_platform: tenant and owner self-scope, platform schema, documents bucket.
--
-- SPEC §6 requires every policy to scope by organization *and* by what the signed-in
-- user may see inside it. The finance, ledger, ops and reporting tables shipped with
-- `org_id = auth_org()` alone, which lets any member of an organization — including a
-- tenant — read the whole organization's money data. The portals make that exploitable,
-- so this migration rewrites those select policies.
--
-- Rules:
--   staff   (org_admin, manager, accountant, caretaker): unchanged — organization-wide.
--   owner:  rows on buildings they own, their own statements, payouts and approvals.
--   tenant: rows on their own leases, their own payments, their own requests.
--
-- Platform admins are not org members: `member_role` has no value for them and must
-- not grow one. They live in `platform_admins` (see docs/DECISIONS.md D-015).

-- ─────────────────────────────────────────────────────────────────────────────
-- platform tables
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create table if not exists public.plans (
  code        text primary key,
  name        text,
  limits      jsonb not null default '{}',
  features    jsonb not null default '{}',
  price_minor bigint,
  currency    char (3)
);

create table if not exists public.subscriptions (
  org_id     uuid primary key references public.organizations (id) on delete cascade,
  plan_code  text references public.plans (code),
  status     text not null default 'active',
  period_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create table if not exists public.usage_snapshots (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  taken_on   date not null,
  units      int not null default 0,
  users      int not null default 0,
  storage_mb int not null default 0,
  primary key (org_id, taken_on)
);

create index if not exists subscriptions_org_idx on public.subscriptions (org_id);

alter table public.platform_admins enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_snapshots enable row level security;

-- platform_admins is service-role only: no policy admits the authenticated role.
create policy "plans_select" on public.plans
  for select to authenticated
  using (true);

create policy "subscriptions_select" on public.subscriptions
  for select to authenticated
  using (org_id = auth_org());

create policy "subscriptions_write" on public.subscriptions
  for all to authenticated
  using (org_id = auth_org() and auth_role() = 'org_admin')
  with check (org_id = auth_org() and auth_role() = 'org_admin');

create policy "usage_snapshots_select" on public.usage_snapshots
  for select to authenticated
  using (org_id = auth_org());

create policy "usage_snapshots_write" on public.usage_snapshots
  for all to authenticated
  using (org_id = auth_org() and auth_role() = 'org_admin')
  with check (org_id = auth_org() and auth_role() = 'org_admin');

-- Custom domains: `custom_domain` already carries a unique index; these columns track
-- whether the owner proved they control the domain.
alter table public.org_branding
  add column if not exists custom_domain_status text not null default 'none';
alter table public.org_branding
  add column if not exists custom_domain_verified_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- scope helpers
-- ─────────────────────────────────────────────────────────────────────────────

-- Staff read the organization; owners and tenants read only their own rows.
create or replace function public.is_staff() returns boolean
language sql stable as $$
  select auth_role() in ('org_admin', 'manager', 'accountant', 'caretaker')
$$;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.platform_admins pa where pa.user_id = auth.uid()
  )
$$;

-- Tenants of the active organization who are the signed-in user.
create or replace function public.tenant_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select t.id
  from public.tenants t
  where t.user_id = auth.uid() and t.org_id = auth_org()
$$;

-- Leases held by the signed-in tenant.
create or replace function public.tenant_lease_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select l.id
  from public.leases l
  where l.org_id = auth_org() and l.tenant_id in (select public.tenant_ids())
$$;

-- Owner records belonging to the signed-in user.
create or replace function public.owner_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select o.id
  from public.owners o
  where o.user_id = auth.uid() and o.org_id = auth_org()
$$;

-- Buildings owned by the signed-in user.
create or replace function public.owner_building_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select b.id
  from public.buildings b
  where b.org_id = auth_org() and b.owner_id in (select public.owner_ids())
$$;

-- Leases sitting on the signed-in owner's buildings.
create or replace function public.owner_lease_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select l.id
  from public.leases l
  where l.org_id = auth_org()
    and public.lease_building_id(l.id) in (select public.owner_building_ids())
$$;

-- Tenants leasing from the signed-in owner.
create or replace function public.owner_tenant_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct l.tenant_id
  from public.leases l
  where l.org_id = auth_org()
    and public.lease_building_id(l.id) in (select public.owner_building_ids())
$$;

-- Feature flags come from the organization's plan (SPEC §10).
create or replace function public.org_feature_enabled(p_org uuid, p_feature text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.subscriptions s
    join public.plans p on p.code = s.plan_code
    where s.org_id = p_org and p.features ? p_feature
  )
$$;

-- Documents are generic (entity_type, entity_id); this resolves who may read one.
create or replace function public.document_visible(p_entity_type text, p_entity_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    (p_entity_type = 'building' and p_entity_id in (select public.owner_building_ids()))
    or (p_entity_type = 'unit' and p_entity_id in (
          select u.id from public.units u
          where u.building_id in (select public.owner_building_ids())))
    or (p_entity_type = 'lease' and p_entity_id in (select public.owner_lease_ids()))
    or (p_entity_type = 'lease' and p_entity_id in (select public.tenant_lease_ids()))
    or (p_entity_type = 'tenant' and p_entity_id in (select public.tenant_ids()))
    or (p_entity_type = 'payment' and p_entity_id in (
          select p.id from public.payments p
          where p.tenant_id in (select public.tenant_ids())))
$$;

grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.tenant_ids() to authenticated;
grant execute on function public.tenant_lease_ids() to authenticated;
grant execute on function public.owner_ids() to authenticated;
grant execute on function public.owner_building_ids() to authenticated;
grant execute on function public.owner_lease_ids() to authenticated;
grant execute on function public.owner_tenant_ids() to authenticated;
grant execute on function public.org_feature_enabled(uuid, text) to authenticated;
grant execute on function public.document_visible(text, uuid) to authenticated;

create index if not exists tenants_user_id_idx on public.tenants (user_id) where user_id is not null;
create index if not exists owners_user_id_idx on public.owners (user_id) where user_id is not null;
create index if not exists leases_tenant_id_idx on public.leases (tenant_id);

-- Tenant payment proofs (SPEC §8 T1): a tenant uploads proof and the row waits as
-- `pending_confirmation`. It carries no receipt number until staff confirm it, so both
-- receipt columns become optional and a status column is added.
alter table public.payments add column if not exists status text not null default 'posted';
alter table public.payments add column if not exists proof_path text;
alter table public.payments alter column receipt_no drop not null;
alter table public.payments alter column receipt_year drop not null;

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('posted', 'pending_confirmation', 'reversed'));

create index if not exists payments_status_idx on public.payments (org_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- policy rewrites
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists charges_select on public.charges;
create policy charges_select on public.charges
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or lease_id in (select public.owner_lease_ids())
      or lease_id in (select public.tenant_lease_ids())
    )
  );

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or tenant_id in (select public.owner_tenant_ids())
      or tenant_id in (select public.tenant_ids())
    )
  );

-- Tenants post their own transfer proof as a pending payment; staff post anything.
drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
  for insert to authenticated
  with check (
    org_id = auth_org()
    and (
      auth_role() in ('org_admin', 'manager', 'accountant')
      or (
        auth_role() = 'tenant'
        and status = 'pending_confirmation'
        and tenant_id in (select public.tenant_ids())
      )
    )
  );

drop policy if exists payment_allocations_select on public.payment_allocations;
create policy payment_allocations_select on public.payment_allocations
  for select to authenticated
  using (
    exists (
      select 1 from public.payments p
      where p.id = payment_allocations.payment_id
        and p.org_id = auth_org()
        and (
          public.is_staff()
          or p.tenant_id in (select public.owner_tenant_ids())
          or p.tenant_id in (select public.tenant_ids())
        )
    )
  );

drop policy if exists tenant_credits_select on public.tenant_credits;
create policy tenant_credits_select on public.tenant_credits
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or tenant_id in (select public.owner_tenant_ids())
      or tenant_id in (select public.tenant_ids())
    )
  );

drop policy if exists cheques_select on public.cheques;
create policy cheques_select on public.cheques
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or tenant_id in (select public.owner_tenant_ids())
      or tenant_id in (select public.tenant_ids())
    )
  );

drop policy if exists deposits_select on public.deposits;
create policy deposits_select on public.deposits
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or tenant_id in (select public.owner_tenant_ids())
      or tenant_id in (select public.tenant_ids())
    )
  );

drop policy if exists deposit_transactions_select on public.deposit_transactions;
create policy deposit_transactions_select on public.deposit_transactions
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or exists (
        select 1 from public.deposits d
        where d.id = deposit_transactions.deposit_id
          and (
            d.tenant_id in (select public.owner_tenant_ids())
            or d.tenant_id in (select public.tenant_ids())
          )
      )
    )
  );

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or building_id in (select public.owner_building_ids())
    )
  );

drop policy if exists maintenance_requests_select on public.maintenance_requests;
create policy maintenance_requests_select on public.maintenance_requests
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or building_id in (select public.owner_building_ids())
      or tenant_id in (select public.tenant_ids())
    )
  );

-- Tenants raise their own requests; staff raise any.
drop policy if exists maintenance_requests_insert on public.maintenance_requests;
create policy maintenance_requests_insert on public.maintenance_requests
  for insert to authenticated
  with check (
    org_id = auth_org()
    and (
      public.is_staff()
      or tenant_id in (select public.tenant_ids())
    )
  );

drop policy if exists maintenance_events_select on public.maintenance_events;
create policy maintenance_events_select on public.maintenance_events
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or exists (
        select 1 from public.maintenance_requests mr
        where mr.id = maintenance_events.request_id
          and (
            mr.building_id in (select public.owner_building_ids())
            or mr.tenant_id in (select public.tenant_ids())
          )
      )
    )
  );

drop policy if exists meters_select on public.meters;
create policy meters_select on public.meters
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or building_id in (select public.owner_building_ids())
    )
  );

drop policy if exists meter_readings_select on public.meter_readings;
create policy meter_readings_select on public.meter_readings
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or exists (
        select 1 from public.meters m
        where m.id = meter_readings.meter_id
          and m.building_id in (select public.owner_building_ids())
      )
    )
  );

drop policy if exists inspections_select on public.inspections;
create policy inspections_select on public.inspections
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or lease_id in (select public.owner_lease_ids())
      or lease_id in (select public.tenant_lease_ids())
    )
  );

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or public.document_visible(entity_type, entity_id)
    )
  );

drop policy if exists owner_statements_select on public.owner_statements;
create policy owner_statements_select on public.owner_statements
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or owner_id in (select public.owner_ids())
    )
  );

drop policy if exists owner_payouts_select on public.owner_payouts;
create policy owner_payouts_select on public.owner_payouts
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or owner_id in (select public.owner_ids())
    )
  );

drop policy if exists owner_expense_approvals_select on public.owner_expense_approvals;
create policy owner_expense_approvals_select on public.owner_expense_approvals
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or owner_id in (select public.owner_ids())
    )
  );

-- An owner decides only their own approval row.
drop policy if exists owner_expense_approvals_write on public.owner_expense_approvals;
create policy owner_expense_approvals_write on public.owner_expense_approvals
  for all to authenticated
  using (
    org_id = auth_org()
    and (
      auth_role() in ('org_admin', 'manager')
      or (auth_role() = 'owner' and owner_id in (select public.owner_ids()))
    )
  )
  with check (
    org_id = auth_org()
    and (
      auth_role() in ('org_admin', 'manager')
      or (auth_role() = 'owner' and owner_id in (select public.owner_ids()))
    )
  );

drop policy if exists owner_ledger_entries_select on public.owner_ledger_entries;
create policy owner_ledger_entries_select on public.owner_ledger_entries
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or building_id in (select public.owner_building_ids())
    )
  );

drop policy if exists journals_select on public.journals;
create policy journals_select on public.journals
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or exists (
        select 1 from public.journal_lines jl
        where jl.journal_id = journals.id
          and (
            jl.building_id in (select public.owner_building_ids())
            or jl.lease_id in (select public.owner_lease_ids())
            or jl.lease_id in (select public.tenant_lease_ids())
            or jl.tenant_id in (select public.tenant_ids())
          )
      )
    )
  );

drop policy if exists journal_lines_select on public.journal_lines;
create policy journal_lines_select on public.journal_lines
  for select to authenticated
  using (
    org_id = auth_org()
    and (
      public.is_staff()
      or building_id in (select public.owner_building_ids())
      or lease_id in (select public.owner_lease_ids())
      or lease_id in (select public.tenant_lease_ids())
      or tenant_id in (select public.tenant_ids())
    )
  );

-- Accounting reference data stays with staff; owners and tenants have no use for it.
drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts
  for select to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager', 'accountant'));

drop policy if exists accounting_periods_select on public.accounting_periods;
create policy accounting_periods_select on public.accounting_periods
  for select to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager', 'accountant'));

drop policy if exists report_definitions_select on public.report_definitions;
create policy report_definitions_select on public.report_definitions
  for select to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager', 'accountant'));

drop policy if exists report_snapshots_select on public.report_snapshots;
create policy report_snapshots_select on public.report_snapshots
  for select to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager', 'accountant'));

-- ─────────────────────────────────────────────────────────────────────────────
-- storage: one private bucket, path {org_id}/{entity}/{id}/{file}
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents_read" on storage.objects;
create policy "documents_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth_org()::text
    and (
      public.is_staff()
      or (storage.foldername(name))[3] in (
            select t.id::text from public.tenants t where t.user_id = auth.uid()
          )
      or (storage.foldername(name))[3] in (
            select l.id::text from public.leases l
            where l.tenant_id in (select public.tenant_ids())
          )
      or (storage.foldername(name))[3] in (
            select b.id::text from public.buildings b
            where b.owner_id in (select public.owner_ids())
          )
      or (storage.foldername(name))[3] in (
            select l.id::text from public.leases l
            where public.lease_building_id(l.id) in (select public.owner_building_ids())
          )
    )
  );

drop policy if exists "documents_write" on storage.objects;
create policy "documents_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth_org()::text
    and (
      public.is_staff()
      or (storage.foldername(name))[2] = 'payment_proof'
        and (storage.foldername(name))[3] in (
              select t.id::text from public.tenants t where t.user_id = auth.uid()
            )
    )
  );
