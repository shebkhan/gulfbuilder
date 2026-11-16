-- 0020_ops: Operations, maintenance, meters, inspections, documents, notifications (M4)

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'maint_priority') then
    create type public.maint_priority as enum ('low', 'normal', 'high', 'urgent');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'maint_status') then
    create type public.maint_status as enum ('open', 'in_progress', 'waiting_parts', 'completed', 'cancelled');
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- maintenance_requests
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.maintenance_requests (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  building_id        uuid not null references public.buildings(id),
  unit_id            uuid references public.units(id),
  room_id            uuid references public.rooms(id),
  tenant_id          uuid references public.tenants(id),
  category           text not null default 'general',
  priority           public.maint_priority not null default 'normal',
  status             public.maint_status not null default 'open',
  title              text not null,
  description        text,
  assigned_vendor_id uuid references public.vendors(id),
  assigned_user_id   uuid references auth.users(id),
  cost_minor         bigint check (cost_minor >= 0),
  currency           text not null default 'QAR',
  charge_to          text not null default 'owner' check (charge_to in ('owner', 'tenant', 'company')),
  expense_id         uuid references public.expenses(id),
  opened_at          timestamptz not null default now(),
  resolved_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists maintenance_org_idx      on public.maintenance_requests(org_id);
create index if not exists maintenance_building_idx on public.maintenance_requests(building_id);
create index if not exists maintenance_status_idx   on public.maintenance_requests(org_id, status);

alter table public.maintenance_requests enable row level security;

create policy "maintenance_requests_select" on public.maintenance_requests
  for select to authenticated
  using (org_id = auth_org());

create policy "maintenance_requests_insert" on public.maintenance_requests
  for insert to authenticated
  with check (org_id = auth_org());

create policy "maintenance_requests_update" on public.maintenance_requests
  for update to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager', 'caretaker', 'accountant'))
  with check (org_id = auth_org() and auth_role() in ('org_admin', 'manager', 'caretaker', 'accountant'));

create trigger trg_maintenance_requests_updated_at
  before update on public.maintenance_requests
  for each row execute function public.set_updated_at();

create trigger trg_maintenance_requests_audit
  after insert or update or delete on public.maintenance_requests
  for each row execute function public.audit_trigger();

-- ─────────────────────────────────────────────────────────────────────────────
-- maintenance_events
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.maintenance_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  request_id  uuid not null references public.maintenance_requests(id) on delete cascade,
  kind        text not null check (kind in ('note', 'status_change', 'assignment', 'cost_update')),
  body        text not null,
  photo_paths text[] not null default '{}',
  author_id   uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists maintenance_events_req_idx on public.maintenance_events(request_id);

alter table public.maintenance_events enable row level security;

create policy "maintenance_events_select" on public.maintenance_events
  for select to authenticated
  using (org_id = auth_org());

create policy "maintenance_events_insert" on public.maintenance_events
  for insert to authenticated
  with check (org_id = auth_org());

-- ─────────────────────────────────────────────────────────────────────────────
-- meters
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.meters (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  building_id uuid references public.buildings(id),
  unit_id     uuid references public.units(id),
  kind        text not null check (kind in ('electricity', 'water', 'gas')),
  meter_no    text not null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists meters_org_idx on public.meters(org_id);

alter table public.meters enable row level security;

create policy "meters_select" on public.meters
  for select to authenticated
  using (org_id = auth_org());

create policy "meters_write" on public.meters
  for all to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager', 'caretaker'))
  with check (org_id = auth_org() and auth_role() in ('org_admin', 'manager', 'caretaker'));

-- ─────────────────────────────────────────────────────────────────────────────
-- meter_readings
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.meter_readings (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  meter_id   uuid not null references public.meters(id) on delete cascade,
  read_on    date not null,
  value      numeric(14,3) not null,
  photo_path text,
  read_by    uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists meter_readings_meter_idx on public.meter_readings(meter_id);

alter table public.meter_readings enable row level security;

create policy "meter_readings_select" on public.meter_readings
  for select to authenticated
  using (org_id = auth_org());

create policy "meter_readings_insert" on public.meter_readings
  for insert to authenticated
  with check (org_id = auth_org() and auth_role() in ('org_admin', 'manager', 'caretaker'));

-- ─────────────────────────────────────────────────────────────────────────────
-- inspections
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.inspections (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  lease_id      uuid not null references public.leases(id) on delete cascade,
  kind          text not null check (kind in ('move_in', 'move_out')),
  data          jsonb not null default '{}',
  completed_at  timestamptz,
  tenant_signed boolean not null default false,
  inspector_id  uuid references auth.users(id),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists inspections_lease_idx on public.inspections(lease_id);

alter table public.inspections enable row level security;

create policy "inspections_select" on public.inspections
  for select to authenticated
  using (org_id = auth_org());

create policy "inspections_write" on public.inspections
  for all to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager', 'caretaker'))
  with check (org_id = auth_org() and auth_role() in ('org_admin', 'manager', 'caretaker'));

-- ─────────────────────────────────────────────────────────────────────────────
-- documents
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null, -- 'lease', 'tenant', 'building', 'unit', 'vendor', 'inspection'
  entity_id   uuid not null,
  kind        text not null, -- 'contract', 'id_card', 'trade_license', 'title_deed', 'photo'
  path        text not null,
  expires_on  date,
  notes       text,
  uploaded_by uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists documents_org_entity_idx on public.documents(org_id, entity_type, entity_id);

alter table public.documents enable row level security;

create policy "documents_select" on public.documents
  for select to authenticated
  using (org_id = auth_org());

create policy "documents_write" on public.documents
  for all to authenticated
  using (org_id = auth_org() and auth_role() in ('org_admin', 'manager', 'caretaker', 'accountant'))
  with check (org_id = auth_org() and auth_role() in ('org_admin', 'manager', 'caretaker', 'accountant'));

-- ─────────────────────────────────────────────────────────────────────────────
-- notification_templates & notification_outbox
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.notification_templates (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  event      text not null,
  channel    text not null check (channel in ('email', 'sms', 'whatsapp', 'push')),
  locale     text not null default 'en',
  subject    text,
  body       text not null,
  created_at timestamptz not null default now(),
  unique (org_id, event, channel, locale)
);

create table if not exists public.notification_outbox (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  event         text not null,
  channel       text not null check (channel in ('email', 'sms', 'whatsapp', 'push')),
  recipient     text not null,
  locale        text not null default 'en',
  subject       text,
  body          text not null,
  payload       jsonb,
  status        text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error         text,
  scheduled_for timestamptz not null default now(),
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists notification_outbox_pending_idx
  on public.notification_outbox(status, scheduled_for)
  where status = 'pending';

alter table public.notification_templates enable row level security;
alter table public.notification_outbox enable row level security;

create policy "notification_templates_select" on public.notification_templates
  for select to authenticated using (org_id = auth_org());

create policy "notification_templates_write" on public.notification_templates
  for all to authenticated using (org_id = auth_org() and auth_role() = 'org_admin')
  with check (org_id = auth_org() and auth_role() = 'org_admin');

create policy "notification_outbox_select" on public.notification_outbox
  for select to authenticated using (org_id = auth_org());

-- ─────────────────────────────────────────────────────────────────────────────
-- RPCs
-- ─────────────────────────────────────────────────────────────────────────────

-- Create maintenance request
create or replace function public.create_maintenance_request(
  p_building_id        uuid,
  p_title              text,
  p_description        text    default null,
  p_unit_id            uuid    default null,
  p_room_id            uuid    default null,
  p_tenant_id          uuid    default null,
  p_category           text    default 'general',
  p_priority           public.maint_priority default 'normal',
  p_assigned_vendor_id uuid    default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_id  uuid;
begin
  v_org := auth_org();

  insert into public.maintenance_requests (
    org_id, building_id, unit_id, room_id, tenant_id,
    category, priority, status, title, description,
    assigned_vendor_id
  ) values (
    v_org, p_building_id, p_unit_id, p_room_id, p_tenant_id,
    p_category, p_priority, 'open', p_title, p_description,
    p_assigned_vendor_id
  ) returning id into v_id;

  -- Initial event
  insert into public.maintenance_events (org_id, request_id, kind, body, author_id)
  values (v_org, v_id, 'status_change', 'Request created', auth.uid());

  return v_id;
end;
$$;

revoke all on function public.create_maintenance_request(uuid,text,text,uuid,uuid,uuid,text,public.maint_priority,uuid) from public;
grant execute on function public.create_maintenance_request(uuid,text,text,uuid,uuid,uuid,text,public.maint_priority,uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Update maintenance status
create or replace function public.update_maintenance_status(
  p_request_id uuid,
  p_status     public.maint_status,
  p_note       text default null,
  p_cost_minor bigint default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_req public.maintenance_requests%rowtype;
begin
  select * into v_req from public.maintenance_requests
  where id = p_request_id and org_id = auth_org();

  if not found then
    raise exception 'Maintenance request not found.';
  end if;

  update public.maintenance_requests
  set status = p_status,
      cost_minor = coalesce(p_cost_minor, cost_minor),
      resolved_at = case when p_status in ('completed', 'cancelled') then now() else resolved_at end
  where id = p_request_id;

  insert into public.maintenance_events (org_id, request_id, kind, body, author_id)
  values (
    auth_org(),
    p_request_id,
    'status_change',
    'Status updated to ' || p_status::text || coalesce(': ' || p_note, ''),
    auth.uid()
  );
end;
$$;

revoke all on function public.update_maintenance_status(uuid,public.maint_status,text,bigint) from public;
grant execute on function public.update_maintenance_status(uuid,public.maint_status,text,bigint) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Complete inspection (feeding deposit deduction if damages found during move_out)
create or replace function public.complete_inspection(
  p_inspection_id uuid,
  p_data          jsonb,
  p_deduct_minor  bigint default 0,
  p_deduct_reason text   default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_insp    public.inspections%rowtype;
  v_deposit public.deposits%rowtype;
begin
  select * into v_insp from public.inspections
  where id = p_inspection_id and org_id = auth_org();

  if not found then
    raise exception 'Inspection not found.';
  end if;

  update public.inspections
  set data = p_data,
      completed_at = now(),
      inspector_id = auth.uid()
  where id = p_inspection_id;

  -- If move_out with damages, feed deposit deduction
  if v_insp.kind = 'move_out' and p_deduct_minor > 0 then
    select * into v_deposit from public.deposits
    where lease_id = v_insp.lease_id and org_id = auth_org();

    if found then
      perform public.apply_deposit_deduction(
        v_deposit.id,
        p_deduct_minor,
        coalesce(p_deduct_reason, 'Damages recorded during move-out inspection')
      );
    end if;
  end if;
end;
$$;

revoke all on function public.complete_inspection(uuid,jsonb,bigint,text) from public;
grant execute on function public.complete_inspection(uuid,jsonb,bigint,text) to authenticated;
