-- 0010_tenants: tenant records with encrypted ID numbers (SPEC 5.3, D-011).
-- Plaintext IDs are only produced by `tenant_id_number`, which checks the caller's role first.

create table tenants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  user_id uuid references auth.users (id),
  kind text not null default 'person',
  full_name text not null,
  nationality text,
  id_type text,
  id_number_enc text,
  id_expiry date,
  phone text,
  whatsapp text,
  email text,
  language text not null default 'ar',
  employer text,
  emergency_contact jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  check (kind in ('person', 'company')),
  check (language in ('ar', 'en'))
);
create index tenants_org_idx on tenants (org_id);
create index tenants_name_idx on tenants (org_id, lower(full_name));
create index tenants_user_idx on tenants (user_id);

create trigger tenants_set_updated_at before update on tenants
  for each row execute function set_updated_at();
create trigger tenants_audit after insert or update or delete on tenants
  for each row execute function audit_trigger();

alter table tenants enable row level security;

-- Staff see the whole directory; a tenant sees only their own row.
create policy tenants_select on tenants for select to authenticated
  using (
    org_id = auth_org()
    and (
      auth_role() in ('org_admin', 'manager', 'accountant')
      or user_id = auth.uid()
    )
  );
create policy tenants_insert on tenants for insert to authenticated
  with check (org_id = auth_org() and auth_role() in ('org_admin', 'manager'));
create policy tenants_update on tenants for update to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager'))
  with check (org_id = auth_org());
create policy tenants_delete on tenants for delete to authenticated
  using (org_id = auth_org() and auth_role() = 'org_admin');

-- The list view never selects id_number_enc, so the ciphertext stays out of page payloads.
create view tenant_directory with (security_invoker = true) as
select id, org_id, user_id, kind, full_name, nationality, phone, whatsapp, email,
       language, employer, deleted_at
from tenants;

-- Decrypts one ID number for a caller allowed to see it. Kept separate from `decrypt_id`,
-- which authenticated roles cannot execute.
create or replace function public.tenant_id_number(p_tenant uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_tenant tenants;
begin
  select * into v_tenant from tenants where id = p_tenant;
  if not found then
    raise exception 'tenant not found' using errcode = 'P0002';
  end if;

  if not (
    (v_tenant.org_id = auth_org() and auth_role() in ('org_admin', 'manager', 'accountant'))
    or v_tenant.user_id = auth.uid()
  ) then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return decrypt_id(v_tenant.id_number_enc);
end;
$$;

revoke all on function public.tenant_id_number(uuid) from public, anon;
grant execute on function public.tenant_id_number(uuid) to authenticated;
