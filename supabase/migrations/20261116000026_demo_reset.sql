-- Demo ledger reset ------------------------------------------------------------
-- Journals are immutable for the application (20261116000017_ledger.sql), so the
-- demo seeder needs one sanctioned way to clear the ledger rows it wrote.
--
-- The trigger now honours a transaction-local flag that only the reset function
-- below sets. App sessions cannot set it, so the books stay immutable for
-- everyone else.

create or replace function public.block_journal_mutation()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.allow_journal_mutation', true), '') = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  raise exception 'Journals and journal lines are immutable. Post a reversal to correct.';
end;
$$;

-- Clears the ledger of the demo organisation only.
create or replace function public.demo_reset_ledger(p_org uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_org <> '63396bf2-9505-44bc-852c-af5c659f47c1'::uuid then
    raise exception 'demo_reset_ledger only applies to the demo organisation';
  end if;

  perform set_config('app.allow_journal_mutation', 'on', true);

  update public.payments set journal_id = null where org_id = p_org;
  update public.deposit_transactions set journal_id = null where org_id = p_org;
  update public.expenses set journal_id = null where org_id = p_org;
  update public.owner_ledger_entries set journal_id = null where org_id = p_org;
  update public.owner_payouts set journal_id = null where org_id = p_org;

  delete from public.journal_lines where org_id = p_org;
  delete from public.journals where org_id = p_org;
end;
$$;

revoke all on function public.demo_reset_ledger(uuid) from public, anon, authenticated;
grant execute on function public.demo_reset_ledger(uuid) to service_role;
