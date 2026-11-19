-- Public marketplace: opt-in listings, a safe anonymous read model and enquiries.
-- The org boundary stays in RLS; public access is granted only through the view.

alter table buildings add column if not exists is_listed_publicly boolean not null default true;
alter table buildings add column if not exists listing_description text;
alter table units add column if not exists is_listed_publicly boolean not null default true;
alter table units add column if not exists listing_title text;
alter table units add column if not exists listing_description text;
alter table units add column if not exists listing_slug text unique;
alter table units add column if not exists listed_at timestamptz;

create table listing_images (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  unit_id uuid not null references units(id),
  path text not null,
  alt_text text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create index listing_images_org_unit_idx on listing_images (org_id, unit_id, sort_order);

create table listing_enquiries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  unit_id uuid not null references units(id),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 255),
  phone text check (char_length(phone) <= 40),
  message text not null check (char_length(message) between 1 and 2000),
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create index listing_enquiries_org_idx on listing_enquiries (org_id, created_at desc);
create index listing_enquiries_unit_idx on listing_enquiries (unit_id);

create trigger listing_images_set_updated_at before update on listing_images
  for each row execute function set_updated_at();
create trigger listing_images_audit after insert or update or delete on listing_images
  for each row execute function audit_trigger();
create trigger listing_enquiries_set_updated_at before update on listing_enquiries
  for each row execute function set_updated_at();
create trigger listing_enquiries_audit after insert or update or delete on listing_enquiries
  for each row execute function audit_trigger();

alter table listing_images enable row level security;
alter table listing_enquiries enable row level security;

-- Shared by the view and the anon insert policy. Security definer so an anon
-- visitor can check a unit's opt-in without reading the underlying tables.
create or replace function is_publicly_listed(p_unit uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from units u
    join buildings b on b.id = u.building_id
    where u.id = p_unit
      and u.is_listed_publicly
      and b.is_listed_publicly
      and u.deleted_at is null
      and b.deleted_at is null
      and u.status = 'vacant'
  );
$$;
revoke all on function is_publicly_listed(uuid) from public;
grant execute on function is_publicly_listed(uuid) to anon, authenticated;

-- The anon insert policy needs the unit's org without reading `units` as anon
-- (units has no anon SELECT policy), so resolve it through a definer too.
create or replace function public_listing_org(p_unit uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select u.org_id from units u where u.id = p_unit;
$$;
revoke all on function public_listing_org(uuid) from public;
grant execute on function public_listing_org(uuid) to anon, authenticated;

-- RLS policies scope leads and images to the buildings the member can access.
create or replace function public_listing_building(p_unit uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select building_id from units where id = p_unit;
$$;
revoke all on function public_listing_building(uuid) from public;
grant execute on function public_listing_building(uuid) to authenticated;

-- Explicit columns only: no tenant, contact, lease or internal financial data.
create or replace view public_listings as
select
  u.id as unit_id,
  u.org_id,
  u.listing_slug as slug,
  coalesce(nullif(u.listing_title, ''), b.name || ' ' || u.unit_no) as title,
  coalesce(nullif(u.listing_description, ''), b.listing_description) as description,
  u.default_rent_minor as rent_minor,
  u.currency,
  u.unit_type,
  u.bedrooms,
  u.bathrooms,
  u.area_sqm,
  u.furnished,
  u.occupancy_type,
  b.city,
  b.zone,
  b.name as building_name,
  b.latitude,
  b.longitude,
  case when coalesce(oi.config ->> 'enabled', 'true') = 'true'
    then coalesce(oi.config ->> 'phone', oi.config ->> 'number') end as whatsapp
from units u
left join org_integrations oi on oi.org_id = u.org_id and oi.provider = 'whatsapp'
join buildings b on b.id = u.building_id
where u.is_listed_publicly
  and b.is_listed_publicly
  and u.deleted_at is null
  and b.deleted_at is null
  and u.status = 'vacant'
  and u.listing_slug is not null;

grant select on public_listings to anon, authenticated;
grant select, insert, update, delete on listing_images, listing_enquiries to authenticated;
grant select on listing_images to anon;
-- Column grant: anon cannot set status/created_by or any internal field via PostgREST.
grant insert (org_id, unit_id, name, email, phone, message) on listing_enquiries to anon;

create policy listing_images_read on listing_images for select
  using (org_id = auth_org() or is_publicly_listed(unit_id));
create policy listing_images_write on listing_images for all
  using (
    org_id = auth_org()
    and auth_role() in ('org_admin', 'manager')
    and can_access_building(public_listing_building(unit_id))
  )
  with check (
    org_id = auth_org()
    and auth_role() in ('org_admin', 'manager')
    and public_listing_org(unit_id) = org_id
    and can_access_building(public_listing_building(unit_id))
  );

create policy listing_enquiries_read on listing_enquiries for select
  using (
    org_id = auth_org()
    and auth_role() in ('org_admin', 'manager', 'accountant')
    and can_access_building(public_listing_building(unit_id))
  );
create policy listing_enquiries_anon_insert on listing_enquiries for insert to anon
  with check (
    is_publicly_listed(unit_id)
    and org_id = public_listing_org(unit_id)
  );
create policy listing_enquiries_org_insert on listing_enquiries for insert to authenticated
  with check (org_id = auth_org());
create policy listing_enquiries_org_update on listing_enquiries for update to authenticated
  using (org_id = auth_org())
  with check (org_id = auth_org());

-- Stable public URLs are required for search-engine images (see DECISIONS.md).
insert into storage.buckets (id, name, public) values ('listing-images', 'listing-images', true)
  on conflict (id) do nothing;

create policy listing_images_bucket_read on storage.objects for select to public
  using (bucket_id = 'listing-images');
create policy listing_images_bucket_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth_org()::text);
create policy listing_images_bucket_update on storage.objects for update to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth_org()::text)
  with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth_org()::text);
create policy listing_images_bucket_delete on storage.objects for delete to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth_org()::text);
