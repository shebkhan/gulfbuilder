-- 00045_bounce_allocation: two small corrections the acceptance probes found.
--
-- 1. `deposit_transactions` was missing the `approved_by` column that SPEC 5.4 lists, so a
--    refund could not record who approved it.
-- 2. A bounced cheque cannot zero its allocation, because the column refuses an amount of
--    zero. The allocation is removed instead: the payment was reversed.

alter table public.deposit_transactions
  add column if not exists approved_by uuid references auth.users(id);

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
      delete from public.payment_allocations
      where payment_id = v_payment.id and charge_id = v_cheque.charge_id;

      update public.charges
      set paid_minor = greatest(coalesce(paid_minor, 0) - v_cheque.amount_minor, 0),
          status = (case
            when greatest(coalesce(paid_minor, 0) - v_cheque.amount_minor, 0) = 0 then 'pending'
            else 'partial'
          end)::charge_status
      where id = v_cheque.charge_id;
    end if;
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
