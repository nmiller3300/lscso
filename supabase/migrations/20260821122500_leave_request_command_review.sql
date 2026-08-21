create or replace function public.review_leave_request(record_id uuid, decision text, review_notes text default null)
returns public.leave_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := app_private.current_profile_id();
  tier text := app_private.current_access_tier();
  result public.leave_requests;
begin
  if caller is null or tier not in ('Executive','Command') then raise exception 'Command approval authority required'; end if;
  if decision not in ('Approved','Denied') then raise exception 'Decision must be Approved or Denied'; end if;
  update public.leave_requests set status=decision, reviewed_by=caller, review_notes=nullif(trim(review_notes),''), reviewed_at=now(), updated_at=now()
  where id=record_id and status in ('Submitted','In Review') returning * into result;
  if result.id is null then raise exception 'Leave request is unavailable for review'; end if;
  insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
  values(result.profile_id,'Request Decision','Leave request ' || lower(decision),'LOA-' || lpad(result.request_number::text,4,'0') || ' was ' || lower(decision) || ' by Command.','/portal/personnel#leave-requests');
  return result;
end; $$;
revoke all on function public.review_leave_request(uuid,text,text) from public, anon;
grant execute on function public.review_leave_request(uuid,text,text) to authenticated, service_role;