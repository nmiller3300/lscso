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
  current_tier text := app_private.current_access_tier();
  updated_request public.personnel_requests;
begin
  if current_profile is null or current_tier not in ('Executive','Command') then
    raise exception 'Command approval authority required';
  end if;

  if decision not in ('Approved','Denied') then
    raise exception 'Decision must be Approved or Denied';
  end if;

  update public.personnel_requests
  set
    status = decision,
    decided_by = current_profile,
    decision_notes = nullif(trim(review_notes), ''),
    decided_at = now(),
    updated_at = now()
  where id = record_id
    and status in ('Submitted','In Review')
  returning * into updated_request;

  if updated_request.id is null then
    raise exception 'Personnel request is unavailable for command review';
  end if;

  insert into public.notifications (
    recipient_profile_id,
    notification_type,
    title,
    message,
    href
  ) values (
    updated_request.requester_profile_id,
    'Request Decision',
    updated_request.request_type || ' request ' || lower(decision),
    'RQ-' || lpad(updated_request.request_number::text, 4, '0') ||
      ' was ' || lower(decision) || ' by Command.',
    '/portal/personnel#requests'
  );

  return updated_request;
end;
$$;

revoke all on function public.review_personnel_request(uuid, text, text) from public, anon;
grant execute on function public.review_personnel_request(uuid, text, text) to authenticated;
