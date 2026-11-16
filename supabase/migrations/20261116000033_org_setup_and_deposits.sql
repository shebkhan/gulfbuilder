-- 00033_org_setup_and_deposits: two gaps the acceptance probes found.
--
-- 1. `create_organization` never seeded the chart of accounts, so every posting RPC in a
--    brand new organization failed with "Account code 1020 not found".
-- 2. A lease deposit produced a charge but no deposit record, and nothing ever moved money
--    into `deposits.held_minor`, so deductions and refunds always hit an empty balance.

create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_country_code char(2) default 'QA',
  p_base_currency char(3) default 'QAR',
  p_locale text default 'en'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from organizations o where o.slug = p_slug) then
    raise exception 'slug already taken' using errcode = '23505';
  end if;

  insert into organizations (name, slug, country_code, base_currency, default_locale, created_by)
  values (p_name, p_slug, p_country_code, p_base_currency, p_locale, auth.uid())
  returning id into v_org;

  insert into org_branding (org_id, app_name, created_by)
  values (v_org, p_name, auth.uid());

  insert into profiles (id, locale, active_org_id, created_by)
  values (auth.uid(), p_locale, v_org, auth.uid())
  on conflict (id) do update set active_org_id = excluded.active_org_id;

  insert into org_members (org_id, user_id, role, created_by)
  values (v_org, auth.uid(), 'org_admin', auth.uid());

  insert into owners (org_id, name, is_company_self, ownership_model, created_by)
  values (v_org, p_name, true, 'self', auth.uid());

  perform public.seed_chart_of_accounts(v_org);

  return v_org;
end;
$$;

-- A deposit charge opens the deposit record, and money paid against it is held there.
create or replace function public.charge_deposit_lifecycle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'deposit' and tg_op = 'INSERT' then
    insert into public.deposits (org_id, lease_id, tenant_id, amount_minor, currency, received_at, notes)
    select l.org_id, l.id, l.tenant_id, new.amount_minor, new.currency, l.start_date, 'Security deposit'
    from public.leases l
    where l.id = new.lease_id
    on conflict (lease_id) do nothing;
    return null;
  end if;

  if new.type = 'deposit' and tg_op = 'UPDATE' and new.paid_minor > coalesce(old.paid_minor, 0) then
    update public.deposits
    set held_minor = held_minor + (new.paid_minor - coalesce(old.paid_minor, 0))
    where lease_id = new.lease_id;
  end if;

  return null;
end;
$$;

drop trigger if exists charges_deposit_lifecycle on charges;
create trigger charges_deposit_lifecycle
  after insert or update of paid_minor on charges
  for each row execute function public.charge_deposit_lifecycle();
