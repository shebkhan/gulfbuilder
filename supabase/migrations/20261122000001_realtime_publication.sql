-- Enable Supabase Realtime on operational tables so the web app can refresh
-- live without polling. Safe to re-run: guards against duplicate membership.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.listing_enquiries;
alter publication supabase_realtime add table public.maintenance_requests;
alter publication supabase_realtime add table public.payments;
alter publication supabase_realtime add table public.notification_outbox;