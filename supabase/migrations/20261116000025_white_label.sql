-- 0025_white_label: resolve an organization from the request host.
--
-- The middleware must know which organization a request belongs to before it knows who
-- is signed in, so it cannot use RLS (org_branding is scoped to the caller's active
-- organization). This function is the one narrow, audited way in: it returns branding
-- fields only — never tenant, lease or money data.

create or replace function public.resolve_org_by_host(p_host text, p_app_host text default null)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'orgId', b.org_id,
    'slug', o.slug,
    'appName', b.app_name,
    'logoUrl', b.logo_url,
    'faviconUrl', b.favicon_url,
    'primaryColor', b.primary_color,
    'secondaryColor', b.secondary_color,
    'fontFamily', b.font_family,
    'terminology', b.terminology,
    'customDomain', b.custom_domain
  )
  from public.org_branding b
  join public.organizations o on o.id = b.org_id
  where (b.custom_domain = lower(p_host) and b.custom_domain_status = 'verified')
     or (
       p_app_host is not null
       and lower(p_host) = lower(o.slug) || '.' || lower(p_app_host)
     )
  limit 1
$$;

revoke all on function public.resolve_org_by_host(text, text) from public;
grant execute on function public.resolve_org_by_host(text, text) to anon, authenticated;
