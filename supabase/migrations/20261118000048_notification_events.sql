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
