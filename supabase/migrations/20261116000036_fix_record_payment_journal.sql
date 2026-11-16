-- 00036_fix_record_payment_journal: journals are immutable, so `record_payment` posted its
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
      status = case
        when coalesce(paid_minor, 0) + (v_alloc->>'amount')::bigint >= amount_minor then 'paid'
        else 'partial'
      end
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
