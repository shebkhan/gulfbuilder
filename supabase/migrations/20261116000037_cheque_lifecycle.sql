-- 00037_cheque_lifecycle: journals are immutable, so `record_payment` posted its
-- journal first and then updated `source_id`, which the immutability trigger rejected. The
-- payment is now inserted first and the journal is posted with the payment id.
--
-- Original note from 0019_fix_record_payment: fix the column name in record_payment from
-- amount_paid_minor to paid_minor.

create or replace function public.record_payment(
  p_tenant_id   uuid,
  p_amount      bigint,
  p_currency    text default 'QAR',
  p_method      public.payment_method default 'cash',
  p_received_at timestamptz default now(),
  p_reference   text default null,
  p_notes       text default null,
  p_lease_id    uuid default null,
  p_allocations jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org           uuid;
  v_receipt_no    int;
  v_receipt_year  int;
  v_payment_id    uuid;
  v_journal_id    uuid;
  v_alloc         jsonb;
  v_alloc_total   bigint := 0;
  v_overpay       bigint;
  v_charge_row    public.charges%rowtype;
begin
  v_org := auth_org();

  if auth_role() not in ('org_admin','manager','accountant') then
    raise exception 'Insufficient role to record payments.';
  end if;

  if p_amount <= 0 then
    raise exception 'Payment amount must be positive.';
  end if;

  -- Validate tenant belongs to org
  if not exists (
    select 1 from public.tenants where id = p_tenant_id and org_id = v_org
  ) then
    raise exception 'Tenant not found in this organization.';
  end if;

  -- Gapless receipt number
  v_receipt_year := extract(year from p_received_at)::int;
  v_receipt_no   := public.next_receipt_number(v_org, v_receipt_year);

  -- Validate allocation total <= payment amount
  for v_alloc in select * from jsonb_array_elements(p_allocations) loop
    v_alloc_total := v_alloc_total + (v_alloc->>'amount')::bigint;
  end loop;

  if v_alloc_total > p_amount then
    raise exception 'Allocation total (%) exceeds payment amount (%).', v_alloc_total, p_amount;
  end if;

  -- Insert the payment first: journals are immutable, so the journal has to be posted with
  -- the payment id already known instead of having its source_id patched afterwards.
  insert into public.payments (
    org_id, tenant_id, lease_id,
    receipt_no, receipt_year,
    amount_minor, currency, method,
    received_at, reference, notes,
    journal_id, created_by
  ) values (
    v_org, p_tenant_id, p_lease_id,
    v_receipt_no, v_receipt_year,
    p_amount, p_currency, p_method,
    p_received_at, p_reference, p_notes,
    null, auth.uid()
  ) returning id into v_payment_id;

  -- Post journal
  v_journal_id := public.post_journal(
    'payment',
    v_payment_id,
    jsonb_build_array(
      jsonb_build_object('account_code','1020','debit', p_amount,  'description','Payment received'),
      jsonb_build_object('account_code','1110','credit',p_amount,  'description','Tenant receivables cleared',
                         'tenant_id', p_tenant_id, 'lease_id', p_lease_id)
    ),
    p_currency,
    'Receipt #' || v_receipt_year || '-' || v_receipt_no
  );

  update public.payments set journal_id = v_journal_id where id = v_payment_id;

  -- Process allocations
  for v_alloc in select * from jsonb_array_elements(p_allocations) loop
    select * into v_charge_row
    from public.charges
    where id = (v_alloc->>'charge_id')::uuid;

    if not found then
      raise exception 'Charge % not found.', v_alloc->>'charge_id';
    end if;

    insert into public.payment_allocations (payment_id, charge_id, amount_minor)
    values (v_payment_id, (v_alloc->>'charge_id')::uuid, (v_alloc->>'amount')::bigint);

    -- Update charge status
    update public.charges
    set
      paid_minor = coalesce(paid_minor, 0) + (v_alloc->>'amount')::bigint,
      status = (case
        when coalesce(paid_minor, 0) + (v_alloc->>'amount')::bigint >= amount_minor then 'paid'
        else 'partial'
      end)::charge_status
    where id = (v_alloc->>'charge_id')::uuid;
  end loop;

  -- Overpayment → tenant credit
  v_overpay := p_amount - v_alloc_total;
  if v_overpay > 0 then
    insert into public.tenant_credits (org_id, tenant_id, source_payment_id, amount_minor, remaining_minor, note)
    values (v_org, p_tenant_id, v_payment_id, v_overpay, v_overpay, 'Overpayment credit');
  end if;

  return v_payment_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Cheques carry the charge they pay, clearing allocates the payment to it, and a cleared
-- cheque can bounce: the payment is reversed and the charge reopens.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.cheques
  add column if not exists charge_id uuid references public.charges(id);

create or replace function public.register_cheque(
  p_tenant_id     uuid,
  p_lease_id      uuid,
  p_cheque_no     text,
  p_bank_name     text,
  p_amount        bigint,
  p_cheque_date   date,
  p_currency      text default 'QAR',
  p_notes         text default null,
  p_charge_id     uuid default null
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
    status, notes, created_by
  ) values (
    v_org, p_tenant_id, p_lease_id, p_charge_id,
    p_cheque_no, p_bank_name,
    p_amount, p_currency, p_cheque_date,
    'received', p_notes, auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.register_cheque(uuid, uuid, text, text, bigint, date, text, text, uuid) from public;
grant execute on function public.register_cheque(uuid, uuid, text, text, bigint, date, text, text, uuid) to authenticated;

create or replace function public.clear_cheque(p_cheque_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_cheque  public.cheques%rowtype;
  v_pay_id  uuid;
  v_allocs  jsonb;
begin
  if auth_role() not in ('org_admin','manager','accountant') then
    raise exception 'Insufficient role.';
  end if;

  select * into v_cheque from public.cheques
  where id = p_cheque_id and org_id = auth_org() and status = 'deposited';

  if not found then
    raise exception 'Cheque not found or not in deposited status.';
  end if;

  -- Mark cleared
  update public.cheques
  set status = 'cleared', cleared_at = now()
  where id = p_cheque_id;

  -- The payment settles the charge the cheque was written for.
  v_allocs := case
    when v_cheque.charge_id is null then '[]'::jsonb
    else jsonb_build_array(jsonb_build_object(
      'charge_id', v_cheque.charge_id,
      'amount', v_cheque.amount_minor
    ))
  end;

  -- Record payment automatically on clearance
  v_pay_id := public.record_payment(
    v_cheque.tenant_id,
    v_cheque.amount_minor,
    v_cheque.currency,
    'cheque',
    now(),
    v_cheque.cheque_no,
    null,
    v_cheque.lease_id,
    v_allocs
  );

  -- Link payment back to cheque
  update public.cheques set payment_id = v_pay_id where id = p_cheque_id;

  return v_pay_id;
end;
$$;

revoke all on function public.clear_cheque(uuid) from public;
grant execute on function public.clear_cheque(uuid) to authenticated;

create or replace function public.bounce_cheque(
  p_cheque_id    uuid,
  p_reason       text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_cheque  public.cheques%rowtype;
  v_payment public.payments%rowtype;
  v_org     uuid;
begin
  if auth_role() not in ('org_admin','manager','accountant') then
    raise exception 'Insufficient role.';
  end if;

  v_org := auth_org();

  select * into v_cheque from public.cheques
  where id = p_cheque_id and org_id = v_org
    and status in ('received', 'deposited', 'cleared');

  if not found then
    raise exception 'Cheque not found or cannot be bounced from current status.';
  end if;

  update public.cheques
  set status = 'bounced', bounce_reason = p_reason
  where id = p_cheque_id;

  -- A cleared cheque is reversed and its charge reopens.
  if v_cheque.status = 'cleared' and v_cheque.payment_id is not null then
    select * into v_payment from public.payments where id = v_cheque.payment_id;

    if v_payment.journal_id is not null then
      perform public.reverse_journal(v_payment.journal_id, coalesce(p_reason, 'Cheque bounced'));
    end if;

    if v_cheque.charge_id is not null then
      update public.charges
      set paid_minor = greatest(coalesce(paid_minor, 0) - v_cheque.amount_minor, 0),
          status = (case
            when greatest(coalesce(paid_minor, 0) - v_cheque.amount_minor, 0) = 0 then 'pending'
            else 'partial'
          end)::charge_status
      where id = v_cheque.charge_id;
    end if;

    update public.payment_allocations
    set amount_minor = 0
    where payment_id = v_payment.id and charge_id = v_cheque.charge_id;
  end if;

  -- The manager and the accountant hear about the bounce right away.
  insert into public.notification_outbox (
    org_id, event, channel, recipient, locale, subject, body, payload, status, scheduled_for
  )
  select
    v_org, 'cheque_bounced', 'email', u.email, coalesce(p.locale, 'en'),
    'Cheque ' || v_cheque.cheque_no || ' bounced',
    coalesce(p_reason, 'The cheque was returned by the bank.'),
    jsonb_build_object('cheque_id', v_cheque.id, 'amount_minor', v_cheque.amount_minor),
    'pending', now()
  from public.org_members m
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.org_id = v_org and m.role in ('org_admin', 'manager', 'accountant');
end;
$$;

revoke all on function public.bounce_cheque(uuid, text) from public;
grant execute on function public.bounce_cheque(uuid, text) to authenticated;
