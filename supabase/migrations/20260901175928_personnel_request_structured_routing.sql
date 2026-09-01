alter table public.personnel_requests
  add column if not exists requested_unit_id uuid references public.organizational_units(id),
  add column if not exists current_reviewer_profile_id uuid references public.personnel_profiles(id),
  add column if not exists current_reviewer_label text,
  add column if not exists routing_stage text,
  add column if not exists routing_label text,
  add column if not exists routing_fallback boolean not null default false,
  add column if not exists routed_at timestamptz;

create index if not exists personnel_requests_current_reviewer_idx
  on public.personnel_requests (current_reviewer_profile_id, status, created_at desc)
  where status in ('Submitted','In Review');

create index if not exists personnel_requests_requested_unit_idx
  on public.personnel_requests (requested_unit_id)
  where requested_unit_id is not null;

create table if not exists public.personnel_request_route_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.personnel_requests(id) on delete cascade,
  event_type text not null,
  stage_label text not null,
  reviewer_profile_id uuid references public.personnel_profiles(id),
  reviewer_label text,
  actor_profile_id uuid references public.personnel_profiles(id),
  actor_label text,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists personnel_request_route_events_request_idx
  on public.personnel_request_route_events (request_id, created_at asc);

alter table public.personnel_request_route_events enable row level security;

drop policy if exists personnel_request_route_events_select on public.personnel_request_route_events;
create policy personnel_request_route_events_select
on public.personnel_request_route_events
for select
to authenticated
using (
  actor_profile_id = (select app_private.current_profile_id())
  or reviewer_profile_id = (select app_private.current_profile_id())
  or exists (
    select 1
    from public.personnel_requests pr
    where pr.id = personnel_request_route_events.request_id
      and (
        pr.requester_profile_id = (select app_private.current_profile_id())
        or pr.current_reviewer_profile_id = (select app_private.current_profile_id())
        or (select app_private.current_access_tier()) in ('Executive','Command')
      )
  )
);

revoke insert, update, delete on public.personnel_request_route_events from authenticated, anon;
grant select on public.personnel_request_route_events to authenticated;

create or replace function app_private.resolve_personnel_request_route(
  p_requester uuid,
  p_request_type text,
  p_requested_unit uuid default null,
  p_stage text default null,
  p_exclude_reviewer uuid default null
)
returns table(
  reviewer_profile_id uuid,
  reviewer_label text,
  route_stage text,
  route_label text,
  route_fallback boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_stage text;
  v_reviewer uuid;
  v_reviewer_label text;
  v_unit uuid;
begin
  v_stage := coalesce(
    nullif(trim(p_stage), ''),
    case
      when p_request_type in ('Promotion','Division Transfer') then 'Supervisor Review'
      when p_request_type = 'Certification' then 'Training Review'
      else 'Executive Command'
    end
  );

  if v_stage = 'Executive Command' then
    return query select null::uuid, 'Sheriff / Undersheriff'::text, 'Executive Command'::text, 'Executive Command'::text, true;
    return;
  end if;

  if v_stage = 'Training Review' then
    select sa.supervisor_profile_id,
           trim(concat_ws(' ', sp.rank, sp.display_name))
      into v_reviewer, v_reviewer_label
    from public.supervisory_authorities sa
    join public.personnel_profiles sp on sp.id = sa.supervisor_profile_id
    left join public.organizational_units ou on ou.id = sa.organizational_unit_id
    where sa.ends_at is null
      and sa.starts_at <= now()
      and sp.status in ('Active','Acting')
      and sa.supervisor_profile_id is distinct from p_requester
      and sa.supervisor_profile_id is distinct from p_exclude_reviewer
      and (
        sa.authority_type = 'Training'
        or lower(coalesce(ou.name, '')) = lower('Training & Recruitment')
      )
    order by case sa.authority_type when 'Training' then 0 when 'Command' then 1 when 'Primary' then 2 else 3 end,
             sa.starts_at desc
    limit 1;

    if v_reviewer is not null then
      return query select v_reviewer, v_reviewer_label, 'Training Review'::text, 'Training & Recruitment'::text, false;
      return;
    end if;

    return query select null::uuid, 'Sheriff / Undersheriff'::text, 'Executive Command'::text, 'Executive Command · Training fallback'::text, true;
    return;
  end if;

  if v_stage = 'Receiving Division Review' then
    if p_requested_unit is not null then
      select sa.supervisor_profile_id,
             trim(concat_ws(' ', sp.rank, sp.display_name))
        into v_reviewer, v_reviewer_label
      from public.supervisory_authorities sa
      join public.personnel_profiles sp on sp.id = sa.supervisor_profile_id
      where sa.ends_at is null
        and sa.starts_at <= now()
        and sa.organizational_unit_id = p_requested_unit
        and sa.authority_type in ('Command','Primary')
        and sp.status in ('Active','Acting')
        and sa.supervisor_profile_id is distinct from p_requester
        and sa.supervisor_profile_id is distinct from p_exclude_reviewer
      order by case sa.authority_type when 'Command' then 0 else 1 end, sa.starts_at desc
      limit 1;
    end if;

    if v_reviewer is not null then
      return query select v_reviewer, v_reviewer_label, 'Receiving Division Review'::text, 'Receiving Division Command'::text, false;
      return;
    end if;

    return query select null::uuid, 'Sheriff / Undersheriff'::text, 'Executive Command'::text, 'Executive Command · receiving-division fallback'::text, true;
    return;
  end if;

  select sa.supervisor_profile_id,
         trim(concat_ws(' ', sp.rank, sp.display_name))
    into v_reviewer, v_reviewer_label
  from public.supervisory_authorities sa
  join public.personnel_profiles sp on sp.id = sa.supervisor_profile_id
  where sa.ends_at is null
    and sa.starts_at <= now()
    and sa.subject_profile_id = p_requester
    and sa.authority_type in ('Primary','Command','Temporary','Conflict Reassignment')
    and sp.status in ('Active','Acting')
    and sa.supervisor_profile_id is distinct from p_requester
    and sa.supervisor_profile_id is distinct from p_exclude_reviewer
  order by case sa.authority_type when 'Primary' then 0 when 'Command' then 1 when 'Conflict Reassignment' then 2 when 'Temporary' then 3 else 4 end,
           sa.starts_at desc
  limit 1;

  if v_reviewer is null then
    select pua.organizational_unit_id
      into v_unit
    from public.personnel_unit_assignments pua
    where pua.profile_id = p_requester
      and pua.ends_at is null
    order by case pua.assignment_type when 'Primary' then 0 else 1 end, pua.starts_at desc
    limit 1;

    if v_unit is not null then
      select sa.supervisor_profile_id,
             trim(concat_ws(' ', sp.rank, sp.display_name))
        into v_reviewer, v_reviewer_label
      from public.supervisory_authorities sa
      join public.personnel_profiles sp on sp.id = sa.supervisor_profile_id
      where sa.ends_at is null
        and sa.starts_at <= now()
        and sa.organizational_unit_id = v_unit
        and sa.authority_type in ('Command','Primary')
        and sp.status in ('Active','Acting')
        and sa.supervisor_profile_id is distinct from p_requester
        and sa.supervisor_profile_id is distinct from p_exclude_reviewer
      order by case sa.authority_type when 'Command' then 0 else 1 end, sa.starts_at desc
      limit 1;
    end if;
  end if;

  if v_reviewer is not null then
    return query select v_reviewer, v_reviewer_label, 'Supervisor Review'::text, 'Direct chain of command'::text, false;
    return;
  end if;

  return query select null::uuid, 'Sheriff / Undersheriff'::text, 'Executive Command'::text, 'Executive Command · no supervisor assigned'::text, true;
end;
$$;

create or replace function app_private.prepare_personnel_request_route()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  route record;
begin
  select * into route
  from app_private.resolve_personnel_request_route(new.requester_profile_id,new.request_type,new.requested_unit_id,null,null);

  new.current_reviewer_profile_id := route.reviewer_profile_id;
  new.current_reviewer_label := route.reviewer_label;
  new.routing_stage := route.route_stage;
  new.routing_label := route.route_label;
  new.routing_fallback := route.route_fallback;
  new.routed_at := now();
  return new;
end;
$$;

drop trigger if exists personnel_request_prepare_route on public.personnel_requests;
create trigger personnel_request_prepare_route
before insert on public.personnel_requests
for each row execute function app_private.prepare_personnel_request_route();

create or replace function app_private.protect_personnel_request_route_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile uuid := app_private.current_profile_id();
begin
  if current_profile = old.requester_profile_id then
    if new.requested_unit_id is distinct from old.requested_unit_id
      or new.current_reviewer_profile_id is distinct from old.current_reviewer_profile_id
      or new.current_reviewer_label is distinct from old.current_reviewer_label
      or new.routing_stage is distinct from old.routing_stage
      or new.routing_label is distinct from old.routing_label
      or new.routing_fallback is distinct from old.routing_fallback
      or new.routed_at is distinct from old.routed_at then
      raise exception 'Request routing fields are system-managed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists personnel_request_protect_route_fields on public.personnel_requests;
create trigger personnel_request_protect_route_fields
before update on public.personnel_requests
for each row execute function app_private.protect_personnel_request_route_fields();

drop trigger if exists personnel_request_status_notifications on public.personnel_requests;

do $$
declare
  request_row record;
  route record;
begin
  for request_row in
    select * from public.personnel_requests
    where status in ('Submitted','In Review')
      and routing_stage is null
  loop
    select * into route
    from app_private.resolve_personnel_request_route(request_row.requester_profile_id,request_row.request_type,request_row.requested_unit_id,null,null);

    update public.personnel_requests
    set current_reviewer_profile_id = route.reviewer_profile_id,
        current_reviewer_label = route.reviewer_label,
        routing_stage = route.route_stage,
        routing_label = route.route_label,
        routing_fallback = route.route_fallback,
        routed_at = now()
    where id = request_row.id;

    insert into public.personnel_request_route_events(
      request_id,event_type,stage_label,reviewer_profile_id,reviewer_label,detail
    ) values (
      request_row.id,'Routed',route.route_label,route.reviewer_profile_id,route.reviewer_label,'Existing open request was attached to the structured routing workflow.'
    );
  end loop;
end;
$$;

create or replace function app_private.notify_personnel_request_routing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_name text;
  request_ref text;
begin
  select p.display_name into requester_name
  from public.personnel_profiles p
  where p.id = new.requester_profile_id;

  request_ref := 'RQ-' || lpad(new.request_number::text, 4, '0');

  if tg_op = 'INSERT' then
    insert into public.personnel_request_route_events(request_id,event_type,stage_label,reviewer_profile_id,reviewer_label,actor_profile_id,actor_label,detail)
    values(new.id,'Submitted',coalesce(new.routing_label,'Routing pending'),new.current_reviewer_profile_id,new.current_reviewer_label,new.requester_profile_id,requester_name,'Request submitted by member.');

    insert into public.personnel_request_route_events(request_id,event_type,stage_label,reviewer_profile_id,reviewer_label,detail)
    values(new.id,'Routed',coalesce(new.routing_label,'Routing pending'),new.current_reviewer_profile_id,new.current_reviewer_label,'Initial reviewer resolved automatically from the current organizational authority structure.');

    insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
    values(new.requester_profile_id,'Personnel Request',new.request_type || ' request submitted',request_ref || ' was submitted. Current routing: ' || coalesce(new.current_reviewer_label,new.routing_label,'Command review') || '.','/portal/my-office#requests');

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

    insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
    values(new.requester_profile_id,'Request Routing',new.request_type || ' request advanced',request_ref || ' is now with ' || coalesce(new.current_reviewer_label,new.routing_label,'Command') || '.','/portal/my-office#requests');

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
$$;

create trigger personnel_request_routing_notifications
after insert or update on public.personnel_requests
for each row execute function app_private.notify_personnel_request_routing();