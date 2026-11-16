-- 00031_acceptance_cleanup: deletes the fixture profiles before the organizations they point at. the fixtures of the acceptance probes are removed in dependency
-- order, because most foreign keys do not cascade.

create or replace function public.acceptance_cleanup()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_orgs uuid[] := array[
    '00000000-0000-0000-0000-000000000aa1'::uuid,
    '00000000-0000-0000-0000-000000000bb1'::uuid
  ];
begin
  delete from deposit_transactions where org_id = any(v_orgs);
  delete from payment_allocations where charge_id in (select id from charges where org_id = any(v_orgs));
  delete from tenant_credits where org_id = any(v_orgs);
  delete from lease_occupants where org_id = any(v_orgs);
  delete from lease_terms where org_id = any(v_orgs);
  delete from journal_lines where org_id = any(v_orgs);
  delete from owner_ledger_entries where org_id = any(v_orgs);
  delete from owner_payouts where org_id = any(v_orgs);
  delete from owner_expense_approvals where org_id = any(v_orgs);
  delete from owner_statements where org_id = any(v_orgs);
  delete from charges where org_id = any(v_orgs);
  delete from cheques where org_id = any(v_orgs);
  delete from payments where org_id = any(v_orgs);
  delete from deposits where org_id = any(v_orgs);
  delete from inspections where org_id = any(v_orgs);
  delete from documents where org_id = any(v_orgs);
  delete from maintenance_requests where org_id = any(v_orgs);
  delete from meters where org_id = any(v_orgs);
  delete from meter_readings where org_id = any(v_orgs);
  delete from expenses where org_id = any(v_orgs);
  delete from leases where org_id = any(v_orgs);
  delete from tenants where org_id = any(v_orgs);
  delete from rooms where org_id = any(v_orgs);
  delete from units where org_id = any(v_orgs);
  delete from floors where org_id = any(v_orgs);
  delete from member_building_access where org_id = any(v_orgs);
  delete from buildings where org_id = any(v_orgs);
  delete from owners where org_id = any(v_orgs);
  delete from accounts where org_id = any(v_orgs);
  delete from accounting_periods where org_id = any(v_orgs);
  delete from bank_accounts where org_id = any(v_orgs);
  delete from notification_outbox where org_id = any(v_orgs);
  delete from notification_templates where org_id = any(v_orgs);
  delete from report_snapshots where org_id = any(v_orgs);
  delete from report_definitions where org_id = any(v_orgs);
  delete from org_branding where org_id = any(v_orgs);
  delete from org_members where org_id = any(v_orgs);
  delete from profiles where id in (
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000a2',
    '00000000-0000-0000-0000-0000000000a3',
    '00000000-0000-0000-0000-0000000000a4',
    '00000000-0000-0000-0000-0000000000a5',
    '00000000-0000-0000-0000-0000000000b1'
  );
  delete from auth.users where id in (
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000a2',
    '00000000-0000-0000-0000-0000000000a3',
    '00000000-0000-0000-0000-0000000000a4',
    '00000000-0000-0000-0000-0000000000a5',
    '00000000-0000-0000-0000-0000000000b1'
  );
  delete from organizations where id = any(v_orgs);
end;
$$;
