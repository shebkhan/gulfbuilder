-- 00043_deposit_approval: SPEC 7.5 says a refund needs the approval permission. The app
-- grants that to org_admin and accountant (src/lib/rbac.ts), but the database let a manager
-- refund a deposit. The refund also records who approved it.

create or replace function public.refund_deposit(
  p_deposit_id uuid,
  p_amount bigint,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_dep public.deposits%rowtype;
begin
  if auth_role() not in ('org_admin','accountant') then
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

  insert into public.deposit_transactions (org_id, deposit_id, kind, amount_minor, reason, approved_by, created_by)
  values (v_dep.org_id, p_deposit_id, 'refund', p_amount, p_reason, auth.uid(), auth.uid());
end;
$$;

revoke all on function public.refund_deposit(uuid, bigint, text) from public;
grant execute on function public.refund_deposit(uuid, bigint, text) to authenticated;
