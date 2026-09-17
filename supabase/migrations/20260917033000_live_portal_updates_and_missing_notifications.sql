-- Deliver missing in-portal/browser notifications for Command Orders and Open
-- Records Requests, and publish core portal tables through Supabase Realtime so
-- open portal pages can refresh automatically when data changes.

create or replace function app_private.notify_command_order_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text;
begin
  if new.status <> 'Active' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'Active' then
    return new;
  end if;

  v_ref := 'CO-' || lpad(new.order_number::text, 4, '0');

  insert into public.notifications (
    recipient_profile_id,
    notification_type,
    title,
    message,
    href
  )
  select
    p.id,
    'Command Order',
    v_ref || ' · ' || new.title,
    'A new Command Order has been published for ' || new.target_audience || '.' ||
      case when new.acknowledgment_required then ' Acknowledgment is required.' else '' end,
    '/portal/orders'
  from public.personnel_profiles p
  where p.status in ('Active','Acting')
    and (
      new.target_audience = 'All Personnel'
      or (
        new.target_audience = 'Supervisors & Command'
        and p.rank in ('Sheriff','Undersheriff','Major','Captain','1st Lieutenant','Lieutenant','Sergeant','Corporal')
      )
      or (
        new.target_audience = 'Command Only'
        and p.rank in ('Sheriff','Undersheriff','Major','Captain','1st Lieutenant')
      )
    );

  return new;
end;
$$;

create or replace function app_private.notify_open_records_request_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text := 'ORR-' || lpad(new.request_number::text, 5, '0');
  v_requester text := btrim(coalesce(new.requester_first_name, '') || ' ' || coalesce(new.requester_last_name, ''));
begin
  insert into public.notifications (
    recipient_profile_id,
    notification_type,
    title,
    message,
    href
  )
  select
    p.id,
    'Open Records Request',
    'New Open Records Request',
    v_ref || ' from ' || coalesce(nullif(v_requester, ''), 'Public Requester') || ' is awaiting Records Custodian review.',
    '/portal/command/administration/open-records/' || new.id::text
  from public.personnel_profiles p
  where p.status in ('Active','Acting')
    and p.rank in ('Sheriff','Undersheriff','Major','Captain','1st Lieutenant');

  return new;
end;
$$;

drop trigger if exists command_order_published_notifications on public.command_orders;
create trigger command_order_published_notifications
after insert or update on public.command_orders
for each row execute function app_private.notify_command_order_published();

drop trigger if exists open_records_request_created_notifications on public.open_records_requests;
create trigger open_records_request_created_notifications
after insert on public.open_records_requests
for each row execute function app_private.notify_open_records_request_created();

DO $realtime$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'notifications',
    'command_orders',
    'command_order_acknowledgments',
    'open_records_requests',
    'recruitment_applications',
    'recruitment_employment_offers',
    'personnel_requests',
    'guardian_records',
    'leave_requests',
    'certifications',
    'personnel_profiles',
    'training_progress',
    'promotion_cases'
  ]
  LOOP
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  END LOOP;
END
$realtime$;
