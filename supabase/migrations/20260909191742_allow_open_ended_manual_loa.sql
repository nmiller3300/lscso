-- Allow executive personnel administrators to record an LOA without a known return date.
-- The legacy column is NOT NULL, so 9999-12-31 is used internally as the open-ended sentinel.

create or replace function public.roster_record_personnel_leave(
  p_profile_id uuid,
  p_leave_type text,
  p_starts_on date,
  p_expected_return_on date,
  p_notes text default null
)
returns public.leave_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := app_private.current_profile_id();
  v_rank text := app_private.current_roster_rank();
  v_target public.personnel_profiles%rowtype;
  v_result public.leave_requests;
  v_expected_return_on date := coalesce(p_expected_return_on, date '9999-12-31');
begin
  if v_caller is null then raise exception 'Authentication required'; end if;
  if v_rank not in ('Sheriff','Undersheriff','Major') then raise exception 'Executive personnel administration authority required'; end if;
  if p_profile_id is null then raise exception 'Select a personnel member'; end if;
  if p_leave_type not in ('Personal','Medical','Military','Family','Administrative','Other') then raise exception 'Invalid leave type'; end if;
  if p_starts_on is null then raise exception 'LOA start date is required'; end if;
  if p_expected_return_on is not null and p_expected_return_on < p_starts_on then raise exception 'Expected return date must be on or after the LOA start date'; end if;

  select * into v_target from public.personnel_profiles p where p.id = p_profile_id for update;
  if v_target.id is null or v_target.status = 'Deactivated' or v_target.is_test_account then raise exception 'Personnel member is unavailable for LOA administration'; end if;

  if exists (
    select 1 from public.leave_requests lr
    where lr.profile_id = p_profile_id and lr.status = 'Approved'
      and daterange(lr.starts_on, lr.expected_return_on, '[]') && daterange(p_starts_on, v_expected_return_on, '[]')
  ) then raise exception 'This personnel member already has an approved LOA overlapping those dates'; end if;

  insert into public.leave_requests(profile_id,leave_type,starts_on,expected_return_on,notes,status,reviewed_by,review_notes,reviewed_at)
  values (
    p_profile_id,p_leave_type,p_starts_on,v_expected_return_on,nullif(trim(coalesce(p_notes,'')),''),'Approved',v_caller,
    case when p_expected_return_on is null
      then 'Administrative open-ended LOA recorded directly from Personnel Roster by ' || v_rank || '; remains active until manually ended.'
      else 'Administrative LOA recorded directly from Personnel Roster by ' || v_rank || '.' end,
    now()
  ) returning * into v_result;
  return v_result;
end;
$$;

create or replace function app_private.notify_leave_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
    else
      insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
      values(new.profile_id,'Leave Request','LOA request submitted','LOA-' || lpad(new.request_number::text,4,'0') || ' was submitted for review.','/portal/my-office#requests');
    end if;
  elsif old.status is distinct from new.status then
    insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
    values(new.profile_id,'Leave Status','LOA request ' || lower(new.status),'LOA-' || lpad(new.request_number::text,4,'0') || ' is now ' || new.status || '.','/portal/my-office#requests');
  end if;
  return new;
end;
$$;

revoke all on function public.roster_record_personnel_leave(uuid,text,date,date,text) from public, anon;
grant execute on function public.roster_record_personnel_leave(uuid,text,date,date,text) to authenticated, service_role;
