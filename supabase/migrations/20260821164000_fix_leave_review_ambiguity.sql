drop function if exists public.review_leave_request(uuid,text,text);

create function public.review_leave_request(
  record_id uuid,
  decision text,
  review_notes text default null
)
returns public.leave_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := app_private.current_profile_id();
  v_tier text := app_private.current_access_tier();
  v_result public.leave_requests;
begin
  if v_caller is null or v_tier not in ('Executive','Command') then
    raise exception 'Command approval authority required';
  end if;

  if $2 not in ('Approved','Denied') then
    raise exception 'Decision must be Approved or Denied';
  end if;

  update public.leave_requests as lr
  set status = $2,
      reviewed_by = v_caller,
      review_notes = nullif(trim($3), ''),
      reviewed_at = now(),
      updated_at = now()
  where lr.id = $1
    and lr.status in ('Submitted','In Review')
  returning lr.* into v_result;

  if v_result.id is null then
    raise exception 'Leave request is unavailable for review';
  end if;

  insert into public.notifications(recipient_profile_id, notification_type, title, message, href)
  values (
    v_result.profile_id,
    'Request Decision',
    'Leave request ' || lower($2),
    'LOA-' || lpad(v_result.request_number::text, 4, '0') || ' was ' || lower($2) || ' by Command.',
    '/portal/personnel#leave-requests'
  );

  return v_result;
end;
$$;

revoke all on function public.review_leave_request(uuid,text,text) from public, anon;
grant execute on function public.review_leave_request(uuid,text,text) to authenticated, service_role;
