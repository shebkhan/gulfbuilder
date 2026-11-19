-- 20261119000003_cheque_images: store cheque photo + OCR-extracted payee

alter table public.cheques
  add column if not exists image_path text,
  add column if not exists payee_raw text;

-- register_cheque (8-param overload, no charge_id)
create or replace function public.register_cheque(
  p_tenant_id     uuid,
  p_lease_id      uuid,
  p_cheque_no     text,
  p_bank_name     text,
  p_amount        bigint,
  p_cheque_date   date,
  p_currency      text default 'QAR',
  p_notes         text default null,
  p_image_path    text default null,
  p_payee_raw     text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org  uuid;
  v_id   uuid;
begin
  v_org := auth_org();

  if auth_role() not in ('org_admin','manager','accountant') then
    raise exception 'Insufficient role to register cheques.';
  end if;

  insert into public.cheques (
    org_id, tenant_id, lease_id,
    cheque_no, bank_name,
    amount_minor, currency, cheque_date,
    status, notes, image_path, payee_raw, created_by
  ) values (
    v_org, p_tenant_id, p_lease_id,
    p_cheque_no, p_bank_name,
    p_amount, p_currency, p_cheque_date,
    'received', p_notes, p_image_path, p_payee_raw, auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.register_cheque(uuid, uuid, text, text, bigint, date, text, text, text, text) from public;
grant execute on function public.register_cheque(uuid, uuid, text, text, bigint, date, text, text, text, text) to authenticated;

-- register_cheque (9-param overload, with charge_id)
create or replace function public.register_cheque(
  p_tenant_id     uuid,
  p_lease_id      uuid,
  p_cheque_no     text,
  p_bank_name     text,
  p_amount        bigint,
  p_cheque_date   date,
  p_currency      text default 'QAR',
  p_notes         text default null,
  p_charge_id     uuid default null,
  p_image_path    text default null,
  p_payee_raw     text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org  uuid;
  v_id   uuid;
begin
  v_org := auth_org();

  if auth_role() not in ('org_admin','manager','accountant') then
    raise exception 'Insufficient role to register cheques.';
  end if;

  if p_charge_id is not null and not exists (
    select 1 from public.charges c
    where c.id = p_charge_id and c.org_id = v_org and c.amount_minor = p_amount
  ) then
    raise exception 'Charge % not found in this organization or has another amount.', p_charge_id;
  end if;

  insert into public.cheques (
    org_id, tenant_id, lease_id, charge_id,
    cheque_no, bank_name,
    amount_minor, currency, cheque_date,
    status, notes, image_path, payee_raw, created_by
  ) values (
    v_org, p_tenant_id, p_lease_id, p_charge_id,
    p_cheque_no, p_bank_name,
    p_amount, p_currency, p_cheque_date,
    'received', p_notes, p_image_path, p_payee_raw, auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.register_cheque(uuid, uuid, text, text, bigint, date, text, text, uuid, text, text) from public;
grant execute on function public.register_cheque(uuid, uuid, text, text, bigint, date, text, text, uuid, text, text) to authenticated;

-- replace_cheque
create or replace function public.replace_cheque(
  p_old_cheque_id uuid,
  p_cheque_no     text,
  p_bank_name     text,
  p_amount        bigint,
  p_cheque_date   date,
  p_currency      text default 'QAR',
  p_notes         text default null,
  p_image_path    text default null,
  p_payee_raw     text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org         uuid;
  v_old         public.cheques%rowtype;
  v_new_id      uuid;
begin
  v_org := auth_org();

  if auth_role() not in ('org_admin','manager','accountant') then
    raise exception 'Insufficient role.';
  end if;

  select * into v_old from public.cheques where id = p_old_cheque_id and org_id = v_org;
  if not found then
    raise exception 'Original cheque not found.';
  end if;

  insert into public.cheques (
    org_id, tenant_id, lease_id, charge_id,
    cheque_no, bank_name,
    amount_minor, currency, cheque_date,
    status, notes, image_path, payee_raw, created_by
  ) values (
    v_org, v_old.tenant_id, v_old.lease_id, v_old.charge_id,
    p_cheque_no, p_bank_name,
    p_amount, p_currency, p_cheque_date,
    'received', p_notes, p_image_path, p_payee_raw, auth.uid()
  ) returning id into v_new_id;

  update public.cheques set replaced_by = v_new_id, status = 'replaced' where id = p_old_cheque_id;

  return v_new_id;
end;
$$;

revoke all on function public.replace_cheque(uuid, text, text, bigint, date, text, text, text, text) from public;
grant execute on function public.replace_cheque(uuid, text, text, bigint, date, text, text, text, text) to authenticated;

-- storage bucket
insert into storage.buckets (id, name, public)
values ('cheques', 'cheques', false)
on conflict (id) do nothing;

drop policy if exists "cheques_read" on storage.objects;
create policy "cheques_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'cheques' and (storage.foldername(name))[1] = auth_org()::text and is_staff());

drop policy if exists "cheques_write" on storage.objects;
create policy "cheques_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cheques' and (storage.foldername(name))[1] = auth_org()::text and is_staff());

drop policy if exists "cheques_delete" on storage.objects;
create policy "cheques_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cheques' and (storage.foldername(name))[1] = auth_org()::text and is_staff());
