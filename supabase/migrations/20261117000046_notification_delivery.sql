-- 00046_notification_delivery: schema for delivering outbox notifications (1A).
--
-- The dispatch worker claims pending rows with `claim_notification_batch`, so the
-- outbox gains `attempts`/`claimed_at` bookkeeping and the channel checks gain
-- 'telegram' (WhatsApp stays for existing data even though no adapter ships in 1A).
-- Telegram linking lands on `profiles`, plus a service-role-only `telegram_state`
-- singleton and per-user `web_push_subscriptions`.

alter table public.notification_outbox
  add column attempts int not null default 0,
  add column claimed_at timestamptz;

alter table public.notification_outbox
  drop constraint notification_outbox_channel_check;

alter table public.notification_outbox
  add constraint notification_outbox_channel_check
  check (channel in ('email', 'sms', 'whatsapp', 'push', 'telegram'));

alter table public.notification_templates
  drop constraint notification_templates_channel_check;

alter table public.notification_templates
  add constraint notification_templates_channel_check
  check (channel in ('email', 'sms', 'whatsapp', 'push', 'telegram'));

alter table public.profiles
  add column telegram_chat_id text,
  add column telegram_link_code text,
  add column telegram_link_expires_at timestamptz;

-- Singleton cursor for the Telegram getUpdates poll. Service role only: RLS is on
-- with no policies, so clients see nothing and the worker bypasses RLS.
create table public.telegram_state (
  id             boolean primary key default true,
  last_update_id bigint not null default 0
);

alter table public.telegram_state enable row level security;

insert into public.telegram_state (id) values (true);

create table public.web_push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

alter table public.web_push_subscriptions enable row level security;

create index web_push_subscriptions_org_user_idx
  on public.web_push_subscriptions(org_id, user_id);

create policy "web_push_subscriptions_select" on public.web_push_subscriptions
  for select to authenticated
  using (org_id = auth_org() and user_id = auth.uid());

create policy "web_push_subscriptions_insert" on public.web_push_subscriptions
  for insert to authenticated
  with check (org_id = auth_org() and user_id = auth.uid());

create policy "web_push_subscriptions_delete" on public.web_push_subscriptions
  for delete to authenticated
  using (org_id = auth_org() and user_id = auth.uid());

create trigger web_push_subscriptions_set_updated_at before update
  on public.web_push_subscriptions
  for each row execute function public.set_updated_at();

-- Atomically hand a batch of due pending rows to the dispatch worker: rows are
-- locked with skip locked so concurrent workers never claim the same row, and a
-- claim older than five minutes is treated as stale and reclaimed.
create or replace function public.claim_notification_batch(p_limit int default 50)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    select id
    from public.notification_outbox
    where status = 'pending'
      and (claimed_at is null or claimed_at < now() - interval '5 minutes')
    order by scheduled_for
    for update skip locked
    limit p_limit
  )
  update public.notification_outbox o
  set claimed_at = now()
  from claimed c
  where o.id = c.id
  returning o.*;
end;
$$;

revoke all on function public.claim_notification_batch(int) from public;
grant execute on function public.claim_notification_batch(int) to service_role;
