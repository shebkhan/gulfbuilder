-- Per-org reference data and integration config managed from the platform console.

create table public.org_lookups (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  category   text not null,
  code       text not null,
  label      text not null,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (org_id, category, code)
);

create index org_lookups_org_category_idx
  on public.org_lookups(org_id, category, sort_order);

alter table public.org_lookups enable row level security;

create policy org_lookups_select on public.org_lookups
  for select to authenticated using (org_id = auth_org());

create policy org_lookups_write on public.org_lookups
  for all to authenticated
  using (org_id = auth_org() and auth_role() = 'org_admin')
  with check (org_id = auth_org() and auth_role() = 'org_admin');

create trigger org_lookups_set_updated_at before update on public.org_lookups
  for each row execute function public.set_updated_at();

create table public.org_integrations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  provider   text not null,
  config     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (org_id, provider)
);

create index org_integrations_org_provider_idx
  on public.org_integrations(org_id, provider);

alter table public.org_integrations enable row level security;

create policy org_integrations_select on public.org_integrations
  for select to authenticated using (org_id = auth_org() and auth_role() = 'org_admin');

create policy org_integrations_write on public.org_integrations
  for all to authenticated
  using (org_id = auth_org() and auth_role() = 'org_admin')
  with check (org_id = auth_org() and auth_role() = 'org_admin');

create trigger org_integrations_set_updated_at before update on public.org_integrations
  for each row execute function public.set_updated_at();
