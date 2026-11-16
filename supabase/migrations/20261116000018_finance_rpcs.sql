-- 0018_finance_rpcs: Financial RPC functions (M3 Step 3)
-- next_receipt_number, post_journal, reverse_journal, record_payment,
-- cheque RPCs, deposit RPCs, expense RPCs, period RPCs

-- ─────────────────────────────────────────────────────────────────────────────
-- next_receipt_number
-- Advisory-lock based gapless receipt number per org+year
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.next_receipt_number(
  p_org  uuid,
  p_year int default extract(year from now())::int
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_no int;
begin
  -- Acquire advisory lock scoped to org+year to prevent concurrent gaps
  perform pg_advisory_xact_lock(hashtext(p_org::text || p_year::text));

  insert into public.receipt_sequences (org_id, year, last_no)
  values (p_org, p_year, 1)
  on conflict (org_id, year)
  do update set last_no = receipt_sequences.last_no + 1
  returning last_no into v_no;

  return v_no;
end;
$$;

revoke all  on function public.next_receipt_number(uuid, int) from public;
grant execute on function public.next_receipt_number(uuid, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- post_journal
-- p_lines: [{"account_code":"1110","debit":5000},{"account_code":"4010","credit":5000}]
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.post_journal(
  p_source_type text,
  p_source_id   uuid,
  p_lines       jsonb,
  p_currency    text    default 'QAR',
  p_memo        text    default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org      uuid;
  v_journal  uuid;
  v_line     jsonb;
  v_account  uuid;
  v_debit    bigint;
  v_credit   bigint;
  v_total_dr bigint := 0;
  v_total_cr bigint := 0;
begin
  v_org := auth_org();

  if auth_role() not in ('org_admin','manager','accountant') then
    raise exception 'Insufficient role to post journals.';
  end if;

  -- Validate balance
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_total_dr := v_total_dr + coalesce((v_line->>'debit')::bigint,  0);
    v_total_cr := v_total_cr + coalesce((v_line->>'credit')::bigint, 0);
  end loop;

  if v_total_dr <> v_total_cr then
    raise exception 'Journal is unbalanced: debits=%, credits=%.', v_total_dr, v_total_cr;
  end if;

  -- Create journal header
  insert into public.journals (org_id, source_type, source_id, currency, memo, posted_by)
  values (v_org, p_source_type, p_source_id, p_currency, p_memo, auth.uid())
  returning id into v_journal;

  -- Create lines
  for v_line in select * from jsonb_array_elements(p_lines) loop
    select id into v_account
    from public.accounts
    where org_id = v_org and code = v_line->>'account_code';

    if v_account is null then
      raise exception 'Account code % not found.', v_line->>'account_code';
    end if;

    v_debit  := coalesce((v_line->>'debit')::bigint,  0);
    v_credit := coalesce((v_line->>'credit')::bigint, 0);

    if v_debit = 0 and v_credit = 0 then
      raise exception 'Each journal line must have a non-zero debit or credit.';
    end if;

    insert into public.journal_lines (
      journal_id, org_id, account_id,
      debit_minor, credit_minor,
      tenant_id, lease_id, building_id, unit_id, description
    ) values (
      v_journal, v_org, v_account,
      v_debit, v_credit,
      (v_line->>'tenant_id')::uuid,
      (v_line->>'lease_id')::uuid,
      (v_line->>'building_id')::uuid,
      (v_line->>'unit_id')::uuid,
      v_line->>'description'
    );
  end loop;

  return v_journal;
end;
$$;

revoke all  on function public.post_journal(text, uuid, jsonb, text, text) from public;
grant execute on function public.post_journal(text, uuid, jsonb, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- reverse_journal
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.reverse_journal(
  p_journal_id uuid,
  p_reason     text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org       uuid;
  v_orig      public.journals;
  v_rev_id    uuid;
  v_line      public.journal_lines;
begin
  v_org := auth_org();

  if auth_role() not in ('org_admin','accountant') then
    raise exception 'Insufficient role to reverse journals.';
  end if;

  select * into v_orig from public.journals
  where id = p_journal_id and org_id = v_org;

  if not found then
    raise exception 'Journal not found.';
  end if;

  if v_orig.reversal_of is not null then
    raise exception 'Cannot reverse a reversal journal.';
  end if;

  -- Create reversal journal header
  insert into public.journals (org_id, source_type, source_id, reversal_of, currency, memo, posted_by)
  values (v_org, 'reversal', p_journal_id, p_journal_id, v_orig.currency,
          coalesce(p_reason, 'Reversal of journal ' || p_journal_id), auth.uid())
  returning id into v_rev_id;

  -- Swap debits and credits from original lines
  for v_line in
    select * from public.journal_lines where journal_id = p_journal_id
  loop
    insert into public.journal_lines (
      journal_id, org_id, account_id,
      debit_minor, credit_minor,
      tenant_id, lease_id, building_id, unit_id, description
    ) values (
      v_rev_id, v_org, v_line.account_id,
      v_line.credit_minor, v_line.debit_minor,
      v_line.tenant_id, v_line.lease_id, v_line.building_id, v_line.unit_id,
      'Reversal: ' || coalesce(v_line.description, '')
    );
  end loop;

  return v_rev_id;
end;
$$;

revoke all  on function public.reverse_journal(uuid, text) from public;
grant execute on function public.reverse_journal(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- record_payment
-- ─────────────────────────────────────────────────────────────────────────────
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
  -- p_allocations: [{"charge_id":"...","amount":5000}]
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

  -- Post journal: DR Tenant Receivables / CR Rental Revenue (simplified; allocations drive specific revenue)
  v_journal_id := public.post_journal(
    'payment',
    null,
    jsonb_build_array(
      jsonb_build_object('account_code','1020','debit', p_amount,  'description','Payment received'),
      jsonb_build_object('account_code','1110','credit',p_amount,  'description','Tenant receivables cleared',
                         'tenant_id', p_tenant_id, 'lease_id', p_lease_id)
    ),
    p_currency,
    'Receipt #' || v_receipt_year || '-' || v_receipt_no
  );

  -- Insert payment
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
    v_journal_id, auth.uid()
  ) returning id into v_payment_id;

  -- Update journal source_id now that we have payment_id
  update public.journals set source_id = v_payment_id where id = v_journal_id;

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
      amount_paid_minor = coalesce(amount_paid_minor, 0) + (v_alloc->>'amount')::bigint,
      status = case
        when coalesce(amount_paid_minor, 0) + (v_alloc->>'amount')::bigint >= amount_minor then 'paid'
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

revoke all  on function public.record_payment(uuid,bigint,text,public.payment_method,timestamptz,text,text,uuid,jsonb) from public;
grant execute on function public.record_payment(uuid,bigint,text,public.payment_method,timestamptz,text,text,uuid,jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Cheque RPCs
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.register_cheque(
  p_tenant_id     uuid,
  p_lease_id      uuid,
  p_cheque_no     text,
  p_bank_name     text,
  p_amount        bigint,
  p_cheque_date   date,
  p_currency      text default 'QAR',
  p_notes         text default null
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
    status, notes, created_by
  ) values (
    v_org, p_tenant_id, p_lease_id,
    p_cheque_no, p_bank_name,
    p_amount, p_currency, p_cheque_date,
    'received', p_notes, auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all  on function public.register_cheque(uuid,uuid,text,text,bigint,date,text,text) from public;
grant execute on function public.register_cheque(uuid,uuid,text,text,bigint,date,text,text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.deposit_cheque(
  p_cheque_id     uuid,
  p_bank_account_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth_role() not in ('org_admin','manager','accountant') then
    raise exception 'Insufficient role.';
  end if;

  update public.cheques
  set status = 'deposited',
      deposited_at = now(),
      bank_account_id = coalesce(p_bank_account_id, bank_account_id)
  where id = p_cheque_id and org_id = auth_org() and status = 'received';

  if not found then
    raise exception 'Cheque not found or not in received status.';
  end if;
end;
$$;

revoke all  on function public.deposit_cheque(uuid, uuid) from public;
grant execute on function public.deposit_cheque(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.clear_cheque(p_cheque_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_cheque  public.cheques%rowtype;
  v_pay_id  uuid;
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
    '[]'::jsonb
  );

  -- Link payment back to cheque
  update public.cheques set payment_id = v_pay_id where id = p_cheque_id;

  return v_pay_id;
end;
$$;

revoke all  on function public.clear_cheque(uuid) from public;
grant execute on function public.clear_cheque(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.bounce_cheque(
  p_cheque_id    uuid,
  p_reason       text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth_role() not in ('org_admin','manager','accountant') then
    raise exception 'Insufficient role.';
  end if;

  update public.cheques
  set status = 'bounced', bounce_reason = p_reason
  where id = p_cheque_id and org_id = auth_org()
    and status in ('deposited','received');

  if not found then
    raise exception 'Cheque not found or cannot be bounced from current status.';
  end if;
end;
$$;

revoke all  on function public.bounce_cheque(uuid, text) from public;
grant execute on function public.bounce_cheque(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.replace_cheque(
  p_old_cheque_id  uuid,
  p_cheque_no      text,
  p_bank_name      text,
  p_amount         bigint,
  p_cheque_date    date,
  p_currency       text default 'QAR',
  p_notes          text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_old   public.cheques%rowtype;
  v_new   uuid;
begin
  if auth_role() not in ('org_admin','manager','accountant') then
    raise exception 'Insufficient role.';
  end if;

  select * into v_old from public.cheques
  where id = p_old_cheque_id and org_id = auth_org()
    and status in ('bounced','returned');

  if not found then
    raise exception 'Original cheque not found or cannot be replaced.';
  end if;

  -- Create replacement cheque
  insert into public.cheques (
    org_id, tenant_id, lease_id,
    cheque_no, bank_name, amount_minor, currency, cheque_date,
    status, notes, created_by
  ) values (
    v_old.org_id, v_old.tenant_id, v_old.lease_id,
    p_cheque_no, p_bank_name, p_amount, p_currency, p_cheque_date,
    'received', p_notes, auth.uid()
  ) returning id into v_new;

  -- Mark old cheque replaced
  update public.cheques
  set status = 'replaced', replaced_by = v_new
  where id = p_old_cheque_id;

  return v_new;
end;
$$;

revoke all  on function public.replace_cheque(uuid,text,text,bigint,date,text,text) from public;
grant execute on function public.replace_cheque(uuid,text,text,bigint,date,text,text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Deposit RPCs
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.apply_deposit_deduction(
  p_deposit_id uuid,
  p_amount     bigint,
  p_reason     text,
  p_charge_id  uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_dep public.deposits%rowtype;
begin
  if auth_role() not in ('org_admin','manager') then
    raise exception 'Insufficient role to deduct from deposits.';
  end if;

  select * into v_dep from public.deposits
  where id = p_deposit_id and org_id = auth_org();

  if not found then raise exception 'Deposit not found.'; end if;

  if p_amount <= 0 then raise exception 'Deduction amount must be positive.'; end if;

  if (v_dep.held_minor - v_dep.deducted_minor - v_dep.refunded_minor) < p_amount then
    raise exception 'Insufficient deposit balance for deduction.';
  end if;

  update public.deposits
  set deducted_minor = deducted_minor + p_amount
  where id = p_deposit_id;

  insert into public.deposit_transactions (org_id, deposit_id, kind, amount_minor, charge_id, reason, created_by)
  values (v_dep.org_id, p_deposit_id, 'deduction', p_amount, p_charge_id, p_reason, auth.uid());
end;
$$;

revoke all  on function public.apply_deposit_deduction(uuid,bigint,text,uuid) from public;
grant execute on function public.apply_deposit_deduction(uuid,bigint,text,uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.refund_deposit(
  p_deposit_id uuid,
  p_amount     bigint,
  p_reason     text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_dep public.deposits%rowtype;
begin
  if auth_role() not in ('org_admin','manager') then
    raise exception 'Insufficient role to refund deposits.';
  end if;

  select * into v_dep from public.deposits
  where id = p_deposit_id and org_id = auth_org();

  if not found then raise exception 'Deposit not found.'; end if;

  if p_amount <= 0 then raise exception 'Refund amount must be positive.'; end if;

  if (v_dep.held_minor - v_dep.deducted_minor - v_dep.refunded_minor) < p_amount then
    raise exception 'Insufficient deposit balance for refund.';
  end if;

  update public.deposits
  set refunded_minor = refunded_minor + p_amount
  where id = p_deposit_id;

  insert into public.deposit_transactions (org_id, deposit_id, kind, amount_minor, reason, created_by)
  values (v_dep.org_id, p_deposit_id, 'refund', p_amount, p_reason, auth.uid());
end;
$$;

revoke all  on function public.refund_deposit(uuid,bigint,text) from public;
grant execute on function public.refund_deposit(uuid,bigint,text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Expense RPCs
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.record_expense(
  p_category    text,
  p_description text,
  p_amount      bigint,
  p_date        date,
  p_vendor_id   uuid    default null,
  p_building_id uuid    default null,
  p_unit_id     uuid    default null,
  p_currency    text    default 'QAR',
  p_notes       text    default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_id  uuid;
begin
  v_org := auth_org();

  if auth_role() not in ('org_admin','manager','accountant') then
    raise exception 'Insufficient role to record expenses.';
  end if;

  insert into public.expenses (
    org_id, vendor_id, building_id, unit_id,
    category, description,
    amount_minor, currency, expense_date,
    status, notes, submitted_by
  ) values (
    v_org, p_vendor_id, p_building_id, p_unit_id,
    p_category, p_description,
    p_amount, p_currency, p_date,
    'submitted', p_notes, auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all  on function public.record_expense(text,text,bigint,date,uuid,uuid,uuid,text,text) from public;
grant execute on function public.record_expense(text,text,bigint,date,uuid,uuid,uuid,text,text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.approve_expense(p_expense_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth_role() not in ('org_admin','manager') then
    raise exception 'Only org_admin or manager can approve expenses.';
  end if;

  update public.expenses
  set status = 'approved', approved_by = auth.uid()
  where id = p_expense_id and org_id = auth_org() and status = 'submitted';

  if not found then
    raise exception 'Expense not found or not in submitted status.';
  end if;
end;
$$;

revoke all  on function public.approve_expense(uuid) from public;
grant execute on function public.approve_expense(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.pay_expense(
  p_expense_id      uuid,
  p_bank_account_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_exp public.expenses%rowtype;
  v_jid uuid;
begin
  if auth_role() not in ('org_admin','accountant') then
    raise exception 'Only org_admin or accountant can mark expenses as paid.';
  end if;

  select * into v_exp from public.expenses
  where id = p_expense_id and org_id = auth_org() and status = 'approved';

  if not found then
    raise exception 'Expense not found or not in approved status.';
  end if;

  -- Post journal: DR Operating Expense / CR Bank
  v_jid := public.post_journal(
    'expense',
    p_expense_id,
    jsonb_build_array(
      jsonb_build_object('account_code','5000','debit', v_exp.amount_minor, 'description', v_exp.description,
                         'building_id', v_exp.building_id, 'unit_id', v_exp.unit_id),
      jsonb_build_object('account_code','1020','credit',v_exp.amount_minor, 'description','Expense payment')
    ),
    v_exp.currency,
    'Expense: ' || v_exp.description
  );

  update public.expenses
  set status = 'paid',
      paid_at = now(),
      bank_account_id = coalesce(p_bank_account_id, bank_account_id),
      journal_id = v_jid
  where id = p_expense_id;
end;
$$;

revoke all  on function public.pay_expense(uuid, uuid) from public;
grant execute on function public.pay_expense(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Period RPCs
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.close_period(p_month date)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  v_org := auth_org();

  if auth_role() not in ('org_admin','accountant') then
    raise exception 'Insufficient role to close accounting periods.';
  end if;

  -- Normalize to first of month
  p_month := date_trunc('month', p_month)::date;

  insert into public.accounting_periods (org_id, month, status, closed_by, closed_at)
  values (v_org, p_month, 'closed', auth.uid(), now())
  on conflict (org_id, month)
  do update set status = 'closed', closed_by = auth.uid(), closed_at = now();
end;
$$;

revoke all  on function public.close_period(date) from public;
grant execute on function public.close_period(date) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.reopen_period(p_month date, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  v_org := auth_org();

  if auth_role() <> 'org_admin' then
    raise exception 'Only org_admin can reopen a closed period.';
  end if;

  p_month := date_trunc('month', p_month)::date;

  update public.accounting_periods
  set status = 'open', closed_by = null, closed_at = null
  where org_id = v_org and month = p_month and status = 'closed';

  if not found then
    raise exception 'Period not found or not currently closed.';
  end if;
end;
$$;

revoke all  on function public.reopen_period(date, text) from public;
grant execute on function public.reopen_period(date, text) to authenticated;

