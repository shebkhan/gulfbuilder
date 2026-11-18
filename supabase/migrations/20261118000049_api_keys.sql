-- api_keys: per-owner (and per-user) read-only API keys for n8n integration (D-021)
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  user_id uuid not null references auth.users(id),
  role member_role not null,
  owner_id uuid references owners(id),
  name text not null,
  key_hash text not null unique,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index api_keys_org_idx on api_keys (org_id);
create index api_keys_hash_idx on api_keys (key_hash);

alter table api_keys enable row level security;

create policy api_keys_org_read on api_keys for select
  using (org_id = auth_org());
create policy api_keys_org_write on api_keys for all
  using (org_id = auth_org() and auth_role() in ('org_admin'))
  with check (org_id = auth_org());
