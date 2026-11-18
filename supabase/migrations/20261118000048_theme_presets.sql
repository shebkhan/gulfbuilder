-- 0048_theme_presets: global preset catalog and public branding storage bucket.
-- theme_presets follows the market_packs exception: readable by all signed-in
-- users, written only by the service-role client in the (platform) console.

create table public.theme_presets (
  code text primary key,
  name text not null,
  primary_color text not null,
  secondary_color text not null,
  font_family text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  constraint theme_presets_primary_color_check check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  constraint theme_presets_secondary_color_check check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  constraint theme_presets_font_family_check check (
    char_length(font_family) <= 80 and font_family ~ '^[A-Za-z0-9 ,''-]+$'
  )
);

create trigger theme_presets_set_updated_at before update on public.theme_presets
  for each row execute function set_updated_at();

create unique index one_default_theme_preset on public.theme_presets ((is_default)) where is_default;

alter table public.theme_presets enable row level security;

-- No client write policies: platform routes use the service-role client.
drop policy if exists theme_presets_read on public.theme_presets;
create policy theme_presets_read on public.theme_presets
  for select to authenticated using (true);

-- Public read is required by login, PWA, email and print (no signed URLs).
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

drop policy if exists branding_read on storage.objects;
create policy branding_read on storage.objects
  for select to public
  using (bucket_id = 'branding');

drop policy if exists branding_write on storage.objects;
create policy branding_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = auth_org()::text
    and auth_role() = 'org_admin'
  )
  with check (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = auth_org()::text
    and auth_role() = 'org_admin'
  );
