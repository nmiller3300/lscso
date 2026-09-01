create or replace function public.review_personnel_request(
  record_id uuid,
  decision text,
  review_notes text default null
)
returns public.personnel_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile uuid := app_private.current_profile_id();
  current_rank text;
  actor_label text;
  request_record public.personnel_requests;
  next_route record;
  has_next_route boolean := false;
begin
  select p.rank, trim(concat_ws(' ', p.rank, p.display_name))
    into current_rank, actor_label
  from public.personnel_profiles p
  where p.id = current_profile
    and p.status in ('Active','Acting');

  if current_profile is null then
    raise exception 'Authenticated personnel account required';
  end if;

  if decision not in ('Approved','Denied') then
    raise exception 'Decision must be Approved or Denied';
  end if;

  if coalesce(char_length(trim(review_notes)),0) < 4 then
    raise exception 'A short review note is required';
  end if;

  select * into request_record
  from public.personnel_requests
  where id = record_id
    and status in ('Submitted','In Review')
  for update;

  if request_record.id is null then
    raise exception 'Personnel request is unavailable for review';
  end if;

  if request_record.requester_profile_id = current_profile then
    raise exception 'Personnel may not review their own request';
  end if;

  if request_record.current_reviewer_profile_id is not null then
    if request_record.current_reviewer_profile_id <> current_profile then
      raise exception 'This request is assigned to %', coalesce(request_record.current_reviewer_label,'another reviewer');
    end if;
  elsif not (request_record.routing_fallback and current_rank in ('Sheriff','Undersheriff')) then
    raise exception 'This request is not assigned to your current authority';
  end if;

  if decision = 'Denied' then
    insert into public.personnel_request_route_events(
      request_id,event_type,stage_label,reviewer_profile_id,reviewer_label,actor_profile_id,actor_label,detail
    ) values (
      request_record.id,'Denied',coalesce(request_record.routing_label,request_record.routing_stage,'Review'),request_record.current_reviewer_profile_id,request_record.current_reviewer_label,current_profile,actor_label,trim(review_notes)
    );

    update public.personnel_requests
    set status = 'Denied',
        decided_by = current_profile,
        decision_notes = trim(review_notes),
        decided_at = now(),
        current_reviewer_profile_id = null,
        current_reviewer_label = null,
        routing_stage = 'Completed',
        routing_label = 'Closed · Denied',
        routing_fallback = false,
        routed_at = now(),
        updated_at = now()
    where id = request_record.id
    returning * into request_record;

    return request_record;
  end if;

  insert into public.personnel_request_route_events(
    request_id,event_type,stage_label,reviewer_profile_id,reviewer_label,actor_profile_id,actor_label,detail
  ) values (
    request_record.id,'Stage Approved',coalesce(request_record.routing_label,request_record.routing_stage,'Review'),request_record.current_reviewer_profile_id,request_record.current_reviewer_label,current_profile,actor_label,trim(review_notes)
  );

  if request_record.routing_stage = 'Supervisor Review' and request_record.request_type = 'Promotion' then
    select * into next_route
    from app_private.resolve_personnel_request_route(request_record.requester_profile_id,request_record.request_type,request_record.requested_unit_id,'Executive Command',current_profile);
    has_next_route := true;

  elsif request_record.routing_stage = 'Supervisor Review' and request_record.request_type = 'Division Transfer' then
    select * into next_route
    from app_private.resolve_personnel_request_route(request_record.requester_profile_id,request_record.request_type,request_record.requested_unit_id,'Receiving Division Review',current_profile);
    has_next_route := true;

  elsif request_record.routing_stage = 'Receiving Division Review' then
    select * into next_route
    from app_private.resolve_personnel_request_route(request_record.requester_profile_id,request_record.request_type,request_record.requested_unit_id,'Executive Command',current_profile);
    has_next_route := true;
  end if;

  if has_next_route then
    update public.personnel_requests
    set status = 'In Review',
        current_reviewer_profile_id = next_route.reviewer_profile_id,
        current_reviewer_label = next_route.reviewer_label,
        routing_stage = next_route.route_stage,
        routing_label = next_route.route_label,
        routing_fallback = next_route.route_fallback,
        routed_at = now(),
        updated_at = now()
    where id = request_record.id
    returning * into request_record;

    insert into public.personnel_request_route_events(
      request_id,event_type,stage_label,reviewer_profile_id,reviewer_label,actor_profile_id,actor_label,detail
    ) values (
      request_record.id,'Routed',request_record.routing_label,request_record.current_reviewer_profile_id,request_record.current_reviewer_label,current_profile,actor_label,'Prior stage approved; request advanced automatically.'
    );

    return request_record;
  end if;

  update public.personnel_requests
  set status = 'Approved',
      decided_by = current_profile,
      decision_notes = trim(review_notes),
      decided_at = now(),
      current_reviewer_profile_id = null,
      current_reviewer_label = null,
      routing_stage = 'Completed',
      routing_label = 'Completed · Approved',
      routing_fallback = false,
      routed_at = now(),
      updated_at = now()
  where id = request_record.id
  returning * into request_record;

  insert into public.personnel_request_route_events(
    request_id,event_type,stage_label,actor_profile_id,actor_label,detail
  ) values (
    request_record.id,'Approved','Completed · Approved',current_profile,actor_label,trim(review_notes)
  );

  return request_record;
end;
$$;

revoke all on function public.review_personnel_request(uuid, text, text) from public, anon;
grant execute on function public.review_personnel_request(uuid, text, text) to authenticated;