alter table public.notifications add column if not exists aggregation_key text;
alter table public.notifications add column if not exists item_count integer;
alter table public.notifications add column if not exists updated_at timestamptz;

update public.notifications
set item_count = coalesce(item_count, 1),
    updated_at = coalesce(updated_at, created_at)
where item_count is null or updated_at is null;

alter table public.notifications alter column item_count set default 1;
alter table public.notifications alter column item_count set not null;
alter table public.notifications alter column updated_at set default now();
alter table public.notifications alter column updated_at set not null;

create index if not exists notifications_smart_aggregation_idx
on public.notifications(recipient_profile_id, aggregation_key, updated_at desc)
where read_at is null and aggregation_key is not null;

create or replace function app_private.smart_notify(
  p_recipient_profile_id uuid,
  p_notification_type text,
  p_aggregation_key text,
  p_title text,
  p_message text,
  p_group_title_template text,
  p_group_message_template text,
  p_href text,
  p_window_seconds integer default 120
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_count integer;
  v_window interval := make_interval(secs => greatest(coalesce(p_window_seconds, 120), 1));
begin
  select n.id, n.item_count
    into v_id, v_count
  from public.notifications n
  where n.recipient_profile_id = p_recipient_profile_id
    and n.read_at is null
    and n.aggregation_key = p_aggregation_key
    and n.created_at >= now() - v_window
    and n.updated_at >= now() - v_window
  order by n.updated_at desc
  limit 1
  for update;

  if v_id is null then
    insert into public.notifications(
      recipient_profile_id, notification_type, title, message, href,
      aggregation_key, item_count, updated_at
    ) values (
      p_recipient_profile_id, p_notification_type, p_title, p_message, p_href,
      p_aggregation_key, 1, now()
    )
    returning id into v_id;
    return v_id;
  end if;

  v_count := coalesce(v_count, 1) + 1;
  update public.notifications
  set item_count = v_count,
      title = replace(p_group_title_template, '{count}', v_count::text),
      message = replace(p_group_message_template, '{count}', v_count::text),
      href = p_href,
      created_at = now(),
      updated_at = now()
  where id = v_id;

  return v_id;
end;
$function$;

create or replace function app_private.notify_certification_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.status = 'Current' then
      perform app_private.smart_notify(
        new.profile_id,
        'Certification',
        'certification-issued',
        'Certification issued',
        new.name || ' was added to your personnel record.',
        '{count} certifications issued',
        '{count} certifications were added to your personnel record. Open Certifications to review the batch.',
        '/portal/my-office#certifications',
        120
      );
    end if;
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status = 'Current' then
    perform app_private.smart_notify(
      new.profile_id,'Certification','certification-issued',
      'Certification issued',new.name || ' was added to your personnel record.',
      '{count} certifications issued','{count} certifications were added to your personnel record. Open Certifications to review the batch.',
      '/portal/my-office#certifications',120
    );
  elsif new.status = 'Denied' then
    perform app_private.smart_notify(
      new.profile_id,'Certification','certification-denied',
      'Certification request denied',new.name || ' was denied.',
      '{count} certification requests denied','{count} certification requests were denied. Open Certifications to review the decisions.',
      '/portal/my-office#certifications',120
    );
  elsif new.status = 'Revoked' then
    perform app_private.smart_notify(
      new.profile_id,'Certification','certification-revoked',
      'Certification revoked',new.name || ' was revoked.',
      '{count} certifications revoked','{count} certifications were revoked. Open Certifications to review the changes.',
      '/portal/my-office#certifications',120
    );
  elsif new.status = 'Expired' then
    perform app_private.smart_notify(
      new.profile_id,'Certification','certification-expired',
      'Certification expired',new.name || ' expired.',
      '{count} certifications expired','{count} certifications expired. Open Certifications to review your current qualifications.',
      '/portal/my-office#certifications',120
    );
  end if;

  return new;
end;
$function$;

create or replace function app_private.notify_training_progress()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
    values(new.profile_id,'Training',new.program_type || ' training assigned',new.phase || ' · ' || new.status,'/portal/my-office#training');
  elsif old.phase is distinct from new.phase or old.status is distinct from new.status then
    insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
    values(
      new.profile_id,
      'Training',
      case when new.status = 'Completed' then new.program_type || ' training completed' else new.program_type || ' training updated' end,
      new.phase || ' · ' || new.status || ' · ' || new.progress_percent::text || '%',
      '/portal/my-office#training'
    );
  end if;
  return new;
end;
$function$;

create or replace function app_private.notify_leave_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.status = 'Approved' then
      insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
      values(
        new.profile_id,
        'Leave Status',
        'LOA recorded',
        case when new.expected_return_on = date '9999-12-31'
          then 'LOA-' || lpad(new.request_number::text,4,'0') || ' was approved and recorded starting ' || to_char(new.starts_on, 'Mon DD, YYYY') || ' with no expected return date. It remains active until Command ends it.'
          else 'LOA-' || lpad(new.request_number::text,4,'0') || ' was approved and recorded for ' || to_char(new.starts_on, 'Mon DD, YYYY') || ' through ' || to_char(new.expected_return_on, 'Mon DD, YYYY') || '.'
        end,
        '/portal/my-office#requests'
      );
    end if;
  elsif old.status is distinct from new.status then
    insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
    values(
      new.profile_id,
      'Leave Status',
      'LOA request ' || lower(new.status),
      'LOA-' || lpad(new.request_number::text,4,'0') || ' is now ' || new.status || '.',
      '/portal/my-office#requests'
    );
  end if;
  return new;
end;
$function$;

create or replace function app_private.notify_personnel_request_routing()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  requester_name text;
  request_ref text;
begin
  select p.display_name into requester_name
  from public.personnel_profiles p
  where p.id = new.requester_profile_id;

  request_ref := 'RQ-' || lpad(new.request_number::text, 4, '0');

  if tg_op = 'INSERT' then
    insert into public.personnel_request_route_events(
      request_id,event_type,stage_label,reviewer_profile_id,reviewer_label,actor_profile_id,actor_label,detail
    ) values (
      new.id,'Submitted',coalesce(new.routing_label,'Routing pending'),new.current_reviewer_profile_id,new.current_reviewer_label,new.requester_profile_id,requester_name,'Request submitted by member.'
    );

    insert into public.personnel_request_route_events(
      request_id,event_type,stage_label,reviewer_profile_id,reviewer_label,detail
    ) values (
      new.id,'Routed',coalesce(new.routing_label,'Routing pending'),new.current_reviewer_profile_id,new.current_reviewer_label,'Initial reviewer resolved automatically from the current organizational authority structure.'
    );

    if new.current_reviewer_profile_id is not null and new.current_reviewer_profile_id <> new.requester_profile_id then
      insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
      values(new.current_reviewer_profile_id,'Personnel Request Review','New ' || new.request_type || ' request',coalesce(requester_name,'Personnel') || ' submitted ' || request_ref || '. This request is assigned to you for ' || coalesce(new.routing_label,'review') || '.','/portal/command/approvals#personnel-requests');
    elsif new.routing_fallback then
      insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
      select p.id,'Personnel Request Review','New ' || new.request_type || ' request',coalesce(requester_name,'Personnel') || ' submitted ' || request_ref || '. No assigned reviewer was available; Executive Command review is required.','/portal/command/approvals#personnel-requests'
      from public.personnel_profiles p
      where p.rank in ('Sheriff','Undersheriff') and p.status in ('Active','Acting') and p.id <> new.requester_profile_id;
    end if;

    return new;
  end if;

  if new.status is distinct from old.status and new.status in ('Approved','Denied','Cancelled','Completed') then
    insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
    values(new.requester_profile_id,'Request Decision',new.request_type || ' request ' || lower(new.status),request_ref || ' is now ' || new.status || '.','/portal/my-office#requests');
    return new;
  end if;

  if new.routing_stage is distinct from old.routing_stage
    or new.current_reviewer_profile_id is distinct from old.current_reviewer_profile_id
    or new.routing_label is distinct from old.routing_label then

    if new.current_reviewer_profile_id is not null and new.current_reviewer_profile_id <> new.requester_profile_id then
      insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
      values(new.current_reviewer_profile_id,'Personnel Request Review',new.request_type || ' request assigned',request_ref || ' from ' || coalesce(requester_name,'Personnel') || ' is now assigned to you for ' || coalesce(new.routing_label,'review') || '.','/portal/command/approvals#personnel-requests');
    elsif new.routing_fallback then
      insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
      select p.id,'Personnel Request Review',new.request_type || ' request requires Executive review',request_ref || ' from ' || coalesce(requester_name,'Personnel') || ' is now awaiting Executive Command action.','/portal/command/approvals#personnel-requests'
      from public.personnel_profiles p
      where p.rank in ('Sheriff','Undersheriff') and p.status in ('Active','Acting') and p.id <> new.requester_profile_id;
    end if;
  end if;

  return new;
end;
$function$;