-- 0048: notification event coverage. Enqueue helpers + row-event triggers + reminder scan.

alter table public.notification_outbox add column dedupe_key text;
create unique index notification_outbox_dedupe_idx
  on public.notification_outbox (org_id, event, dedupe_key, recipient)
  where dedupe_key is not null;

-- Display formatting only; the ledger value is never converted. The exponent is the one
-- the currencies table (and `src/lib/money.ts`) already uses, so KWD/BHD/OMR stay 3-digit.
create or replace function public.format_money(p_minor bigint, p_currency text) returns text
language sql stable security definer set search_path = public as $$
  select to_char(
    p_minor / power(10, coalesce((select exponent from public.currencies where code = p_currency), 2)),
    case when coalesce((select exponent from public.currencies where code = p_currency), 2) = 3
      then 'FM999,999,999,990.000' else 'FM999,999,999,990.00' end
  ) || ' ' || p_currency
$$;

-- Resolve subject/body in order: requested-locale template, English template, built-in
-- default, then a generic fallback. Tokens are replaced after the choice is made.
create or replace function public.render_notification(
  p_org uuid, p_event text, p_channel text, p_locale text, p_payload jsonb
) returns table(subject text, body text)
language plpgsql security definer set search_path = public as $$
declare
  v_subject text;
  v_body    text;
  v_key     text;
  v_value   text;
begin
  select t.subject, t.body into v_subject, v_body
  from public.notification_templates t
  where t.org_id = p_org and t.event = p_event and t.channel = p_channel
    and t.locale = coalesce(p_locale, 'en');

  if v_subject is null and v_body is null then
    select t.subject, t.body into v_subject, v_body
    from public.notification_templates t
    where t.org_id = p_org and t.event = p_event and t.channel = p_channel
      and t.locale = 'en';
  end if;

  if v_subject is null and v_body is null then
    case p_event
      when 'payment_received' then
        if p_locale = 'ar' then
          v_subject := 'تم استلام الدفعة';
          v_body := 'استلمنا {{amount}} من {{tenant_name}}. إيصال رقم {{receipt_no}}.';
        else
          v_subject := 'Payment received';
          v_body := 'We received {{amount}} for {{tenant_name}}. Receipt {{receipt_no}}.';
        end if;
      when 'rent_overdue' then
        if p_locale = 'ar' then
          v_subject := 'إيجار متأخر';
          v_body := 'المبلغ {{amount}} للعقد {{lease_no}} كان مستحقاً في {{due_date}} وأصبح متأخراً.';
        else
          v_subject := 'Rent overdue';
          v_body := 'Charge {{amount}} on lease {{lease_no}} was due {{due_date}} and is now overdue.';
        end if;
      when 'lease_expiring' then
        if p_locale = 'ar' then
          v_subject := 'انتهاء عقد الإيجار';
          v_body := 'ينتهي العقد {{lease_no}} في {{end_date}}.';
        else
          v_subject := 'Lease expiring';
          v_body := 'Lease {{lease_no}} ends on {{end_date}}.';
        end if;
      when 'maintenance_requested' then
        if p_locale = 'ar' then
          v_subject := 'طلب صيانة جديد';
          v_body := '{{title}} (الوحدة {{unit_no}}).';
        else
          v_subject := 'New maintenance request';
          v_body := '{{title}} (unit {{unit_no}}).';
        end if;
      when 'maintenance_status_changed' then
        if p_locale = 'ar' then
          v_subject := 'تحديث الصيانة';
          v_body := '{{title}} أصبح الآن {{status}}.';
        else
          v_subject := 'Maintenance update';
          v_body := '{{title}} is now {{status}}.';
        end if;
      when 'document_expiring' then
        if p_locale = 'ar' then
          v_subject := 'انتهاء صلاحية مستند';
          v_body := 'تنتهي صلاحية المستند {{kind}} في {{expires_on}}.';
        else
          v_subject := 'Document expiring';
          v_body := 'Document {{kind}} expires on {{expires_on}}.';
        end if;
      else
        v_subject := p_event;
        v_body := coalesce(p_payload->>'title', p_event);
    end case;
  end if;

  for v_key, v_value in select * from jsonb_each_text(coalesce(p_payload, '{}'::jsonb)) loop
    v_subject := replace(v_subject, '{{' || v_key || '}}', v_value);
    v_body := replace(v_body, '{{' || v_key || '}}', v_value);
  end loop;

  return query select v_subject, v_body;
end;
$$;

create or replace function public.enqueue_notification(
  p_org uuid, p_event text, p_channel text, p_recipient text,
  p_locale text, p_payload jsonb, p_dedupe_key text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_subject text; v_body text;
begin
  if p_recipient is null or btrim(p_recipient) = '' then return; end if;
  select r.subject, r.body into v_subject, v_body
  from public.render_notification(p_org, p_event, p_channel, p_locale, p_payload) r;
  insert into public.notification_outbox
    (org_id, event, channel, recipient, locale, subject, body, payload, status, scheduled_for, dedupe_key)
  values
    (p_org, p_event, p_channel, p_recipient, coalesce(p_locale, 'en'), v_subject, v_body,
     coalesce(p_payload, '{}'::jsonb), 'pending', now(), p_dedupe_key)
  on conflict (org_id, event, dedupe_key, recipient) where dedupe_key is not null do nothing;
end;
$$;

revoke all on function public.enqueue_notification(uuid, text, text, text, text, jsonb, text) from public;
revoke all on function public.render_notification(uuid, text, text, text, jsonb) from public;

-- Row-event triggers. Each function only enqueues through the guarded helper above;
-- money is formatted with format_money, never recomputed here.
-- Tenant/lease lookups also match the row's org_id as a defense-in-depth guard: a row
-- whose tenant/lease belongs to another org must not copy that org's email into ours.

create or replace function public.payments_notify_received() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_recipient   text;
  v_locale      text;
  v_tenant_name text;
begin
  select t.email, coalesce(t.language, 'en'), t.full_name
    into v_recipient, v_locale, v_tenant_name
  from public.tenants t
  where t.id = new.tenant_id and t.org_id = new.org_id;

  perform public.enqueue_notification(
    new.org_id, 'payment_received', 'email', v_recipient, v_locale,
    jsonb_build_object(
      'receipt_no', new.receipt_year::text || '-' || lpad(new.receipt_no::text, 4, '0'),
      'amount', public.format_money(new.amount_minor, new.currency),
      'tenant_name', v_tenant_name
    ),
    'payment:' || new.id
  );
  return new;
end;
$$;

create or replace function public.charges_notify_overdue() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_recipient text;
  v_locale    text;
  v_lease_no  text;
begin
  select t.email, coalesce(t.language, 'en'), l.lease_no
    into v_recipient, v_locale, v_lease_no
  from public.leases l
  join public.tenants t on t.id = l.tenant_id
  where l.id = new.lease_id and l.org_id = new.org_id;

  perform public.enqueue_notification(
    new.org_id, 'rent_overdue', 'email', v_recipient, v_locale,
    jsonb_build_object(
      'amount', public.format_money(new.amount_minor, new.currency),
      'due_date', to_char(new.due_date, 'YYYY-MM-DD'),
      'lease_no', v_lease_no
    ),
    'charge-overdue:' || new.id
  );
  return new;
end;
$$;

create or replace function public.maintenance_notify_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rec     record;
  v_unit_no text;
begin
  v_unit_no := coalesce((select unit_no from public.units where id = new.unit_id), '');
  for v_rec in
    select u.email, coalesce(p.locale, 'en') as locale
    from public.org_members m
    join auth.users u on u.id = m.user_id
    left join public.profiles p on p.id = m.user_id
    where m.org_id = new.org_id
      and m.role in ('org_admin', 'manager', 'caretaker')
      and u.email is not null
  loop
    perform public.enqueue_notification(
      new.org_id, 'maintenance_requested', 'email', v_rec.email, v_rec.locale,
      jsonb_build_object(
        'title', new.title,
        'unit_no', v_unit_no,
        'status', new.status::text
      ),
      'maintenance-requested:' || new.id
    );
  end loop;
  return new;
end;
$$;

create or replace function public.maintenance_notify_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_recipient text;
  v_locale    text;
  v_unit_no   text;
begin
  if new.tenant_id is not null then
    select t.email, coalesce(t.language, 'en')
      into v_recipient, v_locale
    from public.tenants t
    where t.id = new.tenant_id and t.org_id = new.org_id;

    v_unit_no := coalesce((select unit_no from public.units where id = new.unit_id), '');

    perform public.enqueue_notification(
      new.org_id, 'maintenance_status_changed', 'email', v_recipient, v_locale,
      jsonb_build_object(
        'title', new.title,
        'status', new.status::text,
        'unit_no', v_unit_no
      ),
      'maintenance-status:' || new.id || ':' || new.status::text
    );
  end if;
  return new;
end;
$$;

create trigger payments_notify_received
  after insert on public.payments
  for each row execute function public.payments_notify_received();

create trigger charges_notify_overdue
  after update of status on public.charges
  for each row when (new.status = 'overdue' and new.status is distinct from old.status)
  execute function public.charges_notify_overdue();

create trigger maintenance_notify_created
  after insert on public.maintenance_requests
  for each row execute function public.maintenance_notify_created();

create trigger maintenance_notify_status
  after update of status on public.maintenance_requests
  for each row when (new.status is distinct from old.status)
  execute function public.maintenance_notify_status();

-- ─────────────────────────────────────────────────────────────────────────────
-- sweep_overdue: the body of mark_overdue_and_late_fees without auth_org()/auth_role(),
-- so the reminder scan (Task 4) can sweep every org. Settings are read per org because
-- p_org = null spans orgs with different grace periods and fee policies.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sweep_overdue(p_org uuid default null) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  v_row   record;
begin
  -- Mark overdue
  with marked as (
    update public.charges c
    set status = 'overdue'
    from public.organizations o
    where o.id = c.org_id
      and (p_org is null or c.org_id = p_org)
      and c.status in ('pending', 'partial')
      and c.due_date + coalesce((o.settings->>'grace_days')::int, 0) < current_date
    returning c.id
  )
  select count(*) into v_count from marked;

  -- Late fee, once per charge (the unique key on charges stops a second run adding it).
  -- The fee policy is per org, so the guard moves inside the loop.
  for v_row in
    select c.id, c.org_id, c.lease_id,
           c.amount_minor - c.paid_minor as open_minor, c.currency, c.due_date,
           coalesce((o.settings->>'late_fee_minor')::bigint, 0) as fee_minor,
           coalesce((o.settings->>'late_fee_percent')::numeric, 0) as fee_pct
    from public.charges c
    join public.organizations o on o.id = c.org_id
    where (p_org is null or c.org_id = p_org)
      and c.status = 'overdue'
      and c.due_date + coalesce((o.settings->>'grace_days')::int, 0) < current_date
      and not exists (
        select 1 from public.charges f
        where f.lease_id = c.lease_id and f.type = 'late_fee' and f.period_start = c.due_date
      )
  loop
    if v_row.fee_minor > 0 or v_row.fee_pct > 0 then
      insert into public.charges (org_id, lease_id, type, description, period_start, due_date, amount_minor, currency, status)
      values (
        v_row.org_id, v_row.lease_id, 'late_fee', 'Late fee', v_row.due_date, current_date,
        case
          when v_row.fee_pct > 0 then round(v_row.open_minor * v_row.fee_pct / 100)::bigint
          else v_row.fee_minor
        end,
        v_row.currency, 'pending'
      );
    end if;
  end loop;

  return v_count;
end;
$$;

-- Keep the manual RPC's exact signature, role guard and grant: only the body changes.
create or replace function public.mark_overdue_and_late_fees() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := auth_org();
begin
  if auth_role() not in ('org_admin', 'accountant') then
    raise exception 'Insufficient role to run the overdue sweep.' using errcode = '42501';
  end if;
  -- sweep_overdue(null) means every org; the manual RPC has always been org-scoped.
  -- auth_org() is nullable (jwt org_id -> profiles.active_org_id), so keep the original
  -- "NULL org matches nothing, returns 0" behaviour before delegating.
  if v_org is null then return 0; end if;
  return public.sweep_overdue(v_org);
end;
$$;

revoke all on function public.mark_overdue_and_late_fees() from public;
grant execute on function public.mark_overdue_and_late_fees() to authenticated;
revoke all on function public.sweep_overdue(uuid) from public;

-- ─────────────────────────────────────────────────────────────────────────────
-- enqueue_notification_reminders: the dispatch tick (Task 5) calls this over
-- PostgREST. security definer + explicit search_path lets it sweep every org;
-- email is the only channel and dedupe stays owned by enqueue_notification.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.enqueue_notification_reminders() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_lease record;
  v_doc   record;
  v_staff record;
begin
  perform public.sweep_overdue(null);

  for v_lease in
    select l.id, l.org_id, l.lease_no, l.end_date
    from public.leases l
    join public.organizations o on o.id = l.org_id
    where l.status = 'active'
      and l.end_date between current_date
        and current_date + coalesce((o.settings->>'reminder_days')::int, 30)
  loop
    for v_staff in
      select u.email, coalesce(p.locale, 'en') as locale
      from public.org_members m
      join auth.users u on u.id = m.user_id
      left join public.profiles p on p.id = m.user_id
      where m.org_id = v_lease.org_id
        and m.role in ('org_admin', 'manager')
        and u.email is not null
    loop
      perform public.enqueue_notification(
        v_lease.org_id, 'lease_expiring', 'email', v_staff.email, v_staff.locale,
        jsonb_build_object(
          'lease_no', v_lease.lease_no,
          'end_date', to_char(v_lease.end_date, 'YYYY-MM-DD')
        ),
        'lease-expiring:' || v_lease.id || ':' || v_lease.end_date
      );
    end loop;
  end loop;

  for v_doc in
    select d.id, d.org_id, d.kind, d.expires_on
    from public.documents d
    where d.expires_on between current_date and current_date + 30
  loop
    for v_staff in
      select u.email, coalesce(p.locale, 'en') as locale
      from public.org_members m
      join auth.users u on u.id = m.user_id
      left join public.profiles p on p.id = m.user_id
      where m.org_id = v_doc.org_id
        and m.role in ('org_admin', 'manager', 'caretaker')
        and u.email is not null
    loop
      perform public.enqueue_notification(
        v_doc.org_id, 'document_expiring', 'email', v_staff.email, v_staff.locale,
        jsonb_build_object(
          'kind', v_doc.kind,
          'expires_on', to_char(v_doc.expires_on, 'YYYY-MM-DD')
        ),
        'document-expiring:' || v_doc.id || ':' || v_doc.expires_on
      );
    end loop;
  end loop;
end;
$$;

grant execute on function public.enqueue_notification_reminders() to service_role;
revoke all on function public.enqueue_notification_reminders() from public;
