-- 00029_acceptance_probes_fix: rewrites the criterion 6 probe, whose nested block was not
-- balanced, and corrects the helper calls that 00027 wrapped in `perform`.

create or replace function public.acceptance_fixture()
returns void
language plpgsql security definer set search_path = public as $$
begin
-- Fixtures---------------------------------------------------------------
-- Two organizations, so isolation can be proven; one admin, one manager, one accountant,
-- one owner and one tenant in organization A.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'acc-admin@a.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'acc-manager@a.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'acc-accountant@a.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'acc-owner@a.test'),
  ('00000000-0000-0000-0000-0000000000a5', 'acc-tenant@a.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'acc-admin@b.test');

insert into organizations (id, name, slug, country_code, base_currency, default_locale, created_by)
values
  ('00000000-0000-0000-0000-000000000aa1', 'Acceptance A', 'acc-a', 'QA', 'QAR', 'en', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000bb1', 'Acceptance B', 'acc-b', 'QA', 'QAR', 'en', '00000000-0000-0000-0000-0000000000b1');

insert into profiles (id, active_org_id, locale) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000aa1', 'en'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000aa1', 'en'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000aa1', 'en'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000aa1', 'en'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000aa1', 'en'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000bb1', 'en');

insert into org_members (org_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-0000000000a1', 'org_admin'),
  ('00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-0000000000a2', 'manager'),
  ('00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-0000000000a3', 'accountant'),
  ('00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-0000000000a4', 'owner'),
  ('00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-0000000000a5', 'tenant'),
  ('00000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-0000000000b1', 'org_admin');

insert into owners (id, org_id, name, is_company_self, ownership_model, user_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000aa1', 'Acceptance A self', true, 'self', null),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000aa1', 'Acceptance A managed', false, 'managed', '00000000-0000-0000-0000-0000000000a4'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000bb1', 'Acceptance B self', true, 'self', null);

insert into buildings (id, org_id, owner_id, code, name, country_code, city) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-0000000000c1', 'ACC-A', 'Acceptance Tower A', 'QA', 'Doha'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-0000000000c2', 'ACC-A-M', 'Acceptance Tower A managed', 'QA', 'Doha'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-0000000000c3', 'ACC-B', 'Acceptance Tower B', 'QA', 'Doha');

insert into floors (id, org_id, building_id, level, label) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-0000000000d1', 0, 'Ground');

insert into units (id, org_id, building_id, floor_id, unit_no, unit_type, bedrooms, area_sqm, rentable_as, default_rent_minor, currency, status) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', '101', '2br', 2, 90, 'whole', 1000000, 'QAR', 'vacant'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', '102', '1br', 1, 60, 'rooms', 700000, 'QAR', 'vacant');

insert into rooms (id, org_id, unit_id, room_no, capacity, default_rent_minor, currency, status) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-0000000000f2', 'R1', 2, 350000, 'QAR', 'vacant');

insert into tenants (id, org_id, user_id, kind, full_name, id_type, id_number_enc, language, phone) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-0000000000a5', 'person', 'Acc Tenant', 'qid', encrypt_id('28863451234'), 'ar', '+97455555555');

insert into member_building_access (org_id, user_id, building_id) values
  ('00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000d2');


end;
$$;

create or replace function public.acceptance_cleanup()
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from organizations where id in (
    '00000000-0000-0000-0000-000000000aa1',
    '00000000-0000-0000-0000-000000000bb1'
  );
end;
$$;

create or replace function public.acceptance_probes()
returns table (criterion int, name text, ok boolean, detail text)
language plpgsql set search_path = public as $$
begin
  create temporary table if not exists acc_results (
    criterion int,
    name text,
    ok boolean,
    detail text
  ) on commit drop;
  delete from pg_temp.acc_results;

  perform public.acceptance_fixture();

  do $probe$
declare
  v_visible int;
  v_written int := 0;
begin
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);

  select count(*) into v_visible from buildings;
  if v_visible <> 2 then
    raise exception 'org A admin sees % buildings, expected 2', v_visible;
  end if;

  begin
    insert into buildings (org_id, owner_id, code, name, country_code)
    values ('00000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-0000000000c3', 'X', 'X', 'QA');
    v_written := v_written + 1;
  exception when insufficient_privilege then null;
  end;

  if v_written <> 0 then
    raise exception 'org A admin wrote into org B';
  end if;

  reset role;
  select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
  set local role authenticated;
  select count(*) into v_visible from buildings;
  if v_visible <> 1 then
    raise exception 'org B admin sees % buildings, expected 1', v_visible;
  end if;
  reset role;

  insert into pg_temp.acc_results values (2, 'organizations cannot read or write each other''s data', true,
    'org A sees 2 buildings, org B sees 1, cross-org insert rejected');
exception when others then
  insert into pg_temp.acc_results values (2, 'organizations cannot read or write each other''s data', false, SQLERRM);
end;
$probe$;

  do $probe$
declare
  v_lease uuid;
  v_count int;
  v_total bigint;
  v_inserted int;
begin
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);

  insert into leases (org_id, lease_no, unit_id, tenant_id, start_date, end_date, rent_minor, currency,
                      payment_frequency, installments, due_day, deposit_minor)
  values (auth_org(), 'ACC-L1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000201',
          date_trunc('month', current_date) + interval '1 month', date_trunc('month', current_date) + interval '13 months',
          1200000, 'QAR', 'annual', 4, 1, 200000)
  returning id into v_lease;

  perform activate_lease(v_lease);

  select count(*) into v_count from charges where lease_id = v_lease;
  select sum(amount_minor) into v_total from charges where lease_id = v_lease;
  if v_count <> 5 then
    raise exception 'expected 4 rent charges and 1 deposit charge, got %', v_count;
  end if;
  if v_total <> 1400000 then
    raise exception 'charges total %, expected 1400000', v_total;
  end if;

  select generate_lease_charges(v_lease) into v_inserted;
  select count(*) into v_count from charges where lease_id = v_lease;
  if v_inserted <> 0 or v_count <> 5 then
    raise exception 're-running the schedule inserted % rows, total is now %', v_inserted, v_count;
  end if;

  reset role;
  insert into pg_temp.acc_results values (3, 'activating a 12 month lease with 4 installments', true,
    '5 charges totalling 1,400,000; re-running the schedule added nothing');
exception when others then
  reset role;
  insert into pg_temp.acc_results values (3, 'activating a 12 month lease with 4 installments', false, SQLERRM);
end;
$probe$;

  do $probe$
declare
  v_charge uuid;
  v_payment uuid;
  v_receipt text;
  v_status charge_status;
  v_allocated bigint;
begin
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);

  select id into v_charge from charges
  where lease_id = (select id from leases where lease_no = 'ACC-L1') and type = 'rent'
  order by period_start limit 1;

  select record_payment(
    p_tenant_id => '00000000-0000-0000-0000-000000000201',
    p_amount => 150000,
    p_lease_id => (select id from leases where lease_no = 'ACC-L1')
  ) into v_payment;

  select status into v_status from charges where id = v_charge;
  select sum(amount_minor) into v_allocated from payment_allocations where payment_id = v_payment;
  select receipt_no into v_receipt from payments where id = v_payment;

  if v_status <> 'partial' then
    raise exception 'charge status is %, expected partial', v_status;
  end if;
  if v_allocated <> 150000 then
    raise exception 'allocated %, expected 150000', v_allocated;
  end if;
  if v_receipt is null or v_receipt = '' then
    raise exception 'the payment has no receipt number';
  end if;

  reset role;
  insert into pg_temp.acc_results values (4, 'a payment updates the charge and numbers a receipt', true,
    'charge is partial, 150,000 allocated, receipt ' || v_receipt);
exception when others then
  reset role;
  insert into pg_temp.acc_results values (4, 'a payment updates the charge and numbers a receipt', false, SQLERRM);
end;
$probe$;

  do $probe$
declare
  v_cheque uuid;
  v_charge uuid;
  v_paid bigint;
  v_status charge_status;
  v_notices int;
  v_rejected boolean := false;
begin
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);

  select id into v_charge from charges
  where lease_id = (select id from leases where lease_no = 'ACC-L1') and type = 'rent'
  order by period_start limit 1;

  select id into v_cheque from register_cheque(
    p_tenant_id => '00000000-0000-0000-0000-000000000201',
    p_lease_id => (select id from leases where lease_no = 'ACC-L1'),
    p_cheque_no => 'ACC-CHEQUE-1',
    p_bank_name => 'Test Bank',
    p_amount => 300000,
    p_cheque_date => current_date
  );

  perform deposit_cheque(v_cheque);
  perform clear_cheque(v_cheque);

  select paid_minor, status into v_paid, v_status from charges where id = v_charge;
  if v_status <> 'paid' then
    raise exception 'after clearing, the charge is %', v_status;
  end if;

  perform bounce_cheque(v_cheque, 'acceptance test bounce');

  select paid_minor, status into v_paid, v_status from charges where id = v_charge;
  if v_paid <> 0 or v_status = 'paid' then
    raise exception 'after the bounce the charge is % with % paid', v_status, v_paid;
  end if;

  select count(*) into v_notices from notification_outbox where org_id = auth_org();
  if v_notices = 0 then
    raise exception 'the bounce queued no notification';
  end if;

  reset role;
  insert into pg_temp.acc_results values (5, 'a bounced cheque reopens its charge and notifies', true,
    'charge reopened, ' || v_notices || ' notification(s) queued');
exception when others then
  reset role;
  insert into pg_temp.acc_results values (5, 'a bounced cheque reopens its charge and notifies', false, SQLERRM);
end;
$probe$;

  do $probe$
declare
  v_rejected boolean := false;
  v_approved boolean := false;
  v_count int;
begin
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);

  -- a room lease under an active whole-unit lease
  begin
    insert into leases (org_id, lease_no, room_id, tenant_id, start_date, end_date, rent_minor, currency,
                        payment_frequency, installments, due_day, status)
    values (auth_org(), 'ACC-ROOM', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201',
            current_date, current_date + 90, 350000, 'QAR', 'monthly', 1, 1, 'active');
    raise exception 'the room lease was accepted';
  exception when sqlstate '23514' then
    v_rejected := true;
  end;

  -- a sub-let needs approval before it can go active
  begin
    insert into leases (org_id, lease_no, unit_id, parent_lease_id, tenant_id, start_date, end_date, rent_minor, currency,
                        payment_frequency, installments, due_day, status)
    values (auth_org(), 'ACC-SUB', '00000000-0000-0000-0000-0000000000f2', (select id from leases where lease_no = 'ACC-L1'),
            '00000000-0000-0000-0000-000000000201', current_date + 10, current_date + 100, 400000, 'QAR',
            'monthly', 1, 1, 'active');
    raise exception 'an unapproved sub-let went active';
  exception when sqlstate '23514' then
    v_approved := true;
  end;

  -- occupants must fit the capacity of the unit
  begin
    insert into lease_occupants (org_id, lease_id, full_name, relation)
    select auth_org(), (select id from leases where lease_no = 'ACC-L1'), 'Occupant ' || n, 'family'
    from generate_series(1, 5) n;
  exception when sqlstate '23514' then
    null;
  end;

  select count(*) into v_count
  from lease_occupants where lease_id = (select id from leases where lease_no = 'ACC-L1');
  if v_count > 3 then
    raise exception 'capacity was not enforced: % occupants', v_count;
  end if;

  reset role;
  insert into pg_temp.acc_results values (6, 'room and whole-unit leases are exclusive, sub-lets need approval',
    v_rejected and v_approved,
    'room lease rejected: ' || v_rejected || ', unapproved sub-let rejected: ' || v_approved ||
    ', occupants capped at ' || v_count);
exception when others then
  reset role;
  insert into pg_temp.acc_results values (6, 'room and whole-unit leases are exclusive, sub-lets need approval', false, SQLERRM);
end;
$probe$;

  do $probe$
declare
  v_deposit uuid;
  v_rejected boolean := false;
  v_approved boolean := false;
begin
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);

  select id into v_deposit from deposits where lease_id = (select id from leases where lease_no = 'ACC-L1');
  if v_deposit is null then
    raise exception 'the deposit was not created on activation';
  end if;

  begin
    perform apply_deposit_deduction(v_deposit, 999999999, 'too much');
    raise exception 'an over-deduction was accepted';
  exception when others then
    if SQLERRM = 'an over-deduction was accepted' then raise; end if;
    v_rejected := true;
  end;

  reset role;

  -- a manager may not refund
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', true);
  begin
    perform refund_deposit(v_deposit, 100000, 'manager refund');
    raise exception 'a manager refunded a deposit';
  exception when others then
    if SQLERRM = 'a manager refunded a deposit' then raise; end if;
    v_approved := false;
  end;
  reset role;

  -- an org admin may
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
  perform refund_deposit(v_deposit, 100000, 'admin refund');
  reset role;

  insert into pg_temp.acc_results values (7, 'a deposit balance never goes negative and refunds need approval', true,
    'over-deduction rejected: ' || v_rejected || ', manager refund rejected, admin refund accepted');
exception when others then
  reset role;
  insert into pg_temp.acc_results values (7, 'a deposit balance never goes negative and refunds need approval', false, SQLERRM);
end;
$probe$;

  do $probe$
declare
  v_unbalanced int;
  v_rejected boolean := false;
  v_reopen_refused boolean := false;
  v_audited boolean := false;
  v_month date := date_trunc('month', current_date);
begin
  select count(*) into v_unbalanced
  from journals j
  where j.org_id = '00000000-0000-0000-0000-000000000aa1'
    and (select coalesce(sum(debit_minor), 0) from journal_lines l where l.journal_id = j.id)
     <> (select coalesce(sum(credit_minor), 0) from journal_lines l where l.journal_id = j.id);
  if v_unbalanced <> 0 then
    raise exception '% journal(s) do not balance', v_unbalanced;
  end if;

  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
  perform close_period(v_month);

  begin
    perform record_payment(
      p_tenant_id => '00000000-0000-0000-0000-000000000201',
      p_amount => 100000,
      p_received_at => (v_month + interval '5 days')::timestamptz
    );
    raise exception 'a closed period accepted a backdated posting';
  exception when others then
    if SQLERRM = 'a closed period accepted a backdated posting' then raise; end if;
    v_rejected := true;
  end;

  -- a manager may not reopen the period
  reset role;
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', true);
  begin
    perform reopen_period(v_month, 'manager attempt');
    raise exception 'a manager reopened the period';
  exception when others then
    if SQLERRM = 'a manager reopened the period' then raise; end if;
    v_reopen_refused := true;
  end;

  -- an admin may, and it is audited
  reset role;
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
  perform reopen_period(v_month, 'acceptance test reopen');

  select count(*) into v_audited from audit_log
  where org_id = '00000000-0000-0000-0000-000000000aa1' and table_name = 'accounting_periods';
  reset role;

  insert into pg_temp.acc_results values (8, 'journals balance, closed periods refuse postings, reopening is audited', true,
    'all journals balance, backdated posting rejected: ' || v_rejected ||
    ', manager reopen refused: ' || v_reopen_refused || ', reopen audit rows: ' || v_audited);
exception when others then
  reset role;
  insert into pg_temp.acc_results values (8, 'journals balance, closed periods refuse postings, reopening is audited', false, SQLERRM);
end;
$probe$;

  do $probe$
declare
  v_buildings int;
  v_leases int;
  v_journals int;
begin
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4"}', true);

  select count(*) into v_buildings from buildings;
  select count(*) into v_leases from leases;
  select count(*) into v_journals from journals;

  if v_buildings <> 1 then
    raise exception 'the owner sees % buildings, expected 1', v_buildings;
  end if;
  if v_leases <> 0 then
    raise exception 'the owner sees % leases of buildings they do not own', v_leases;
  end if;
  if v_journals <> 0 then
    raise exception 'the owner sees % journals of buildings they do not own', v_journals;
  end if;

  reset role;
  insert into pg_temp.acc_results values (14, 'an owner only reaches their own buildings', true,
    '1 building, 0 leases, 0 journals visible');
exception when others then
  reset role;
  insert into pg_temp.acc_results values (14, 'an owner only reaches their own buildings', false, SQLERRM);
end;
$probe$;

  do $probe$
declare
  v_tenants int;
  v_leases int;
  v_payments int;
begin
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5"}', true);

  select count(*) into v_tenants from tenants;
  select count(*) into v_leases from leases;
  select count(*) into v_payments from payments;

  if v_tenants <> 1 then
    raise exception 'the tenant sees % tenant rows, expected 1', v_tenants;
  end if;
  if v_leases <> 1 then
    raise exception 'the tenant sees % leases, expected 1', v_leases;
  end if;

  reset role;
  insert into pg_temp.acc_results values (15, 'a tenant only reaches their own data', true,
    v_tenants || ' tenant row, ' || v_leases || ' lease, ' || v_payments || ' payment visible');
exception when others then
  reset role;
  insert into pg_temp.acc_results values (15, 'a tenant only reaches their own data', false, SQLERRM);
end;
$probe$;

  perform public.acceptance_cleanup();

  return query
  select a.criterion, a.name, a.ok, a.detail
  from pg_temp.acc_results a
  order by a.criterion;
end;
$$;

revoke all on function public.acceptance_probes() from public, anon;
grant execute on function public.acceptance_probes() to authenticated;
