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
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;
  if v_rank not in ('Sheriff','Undersheriff','Major') then
    raise exception 'Executive personnel administration authority required';
  end if;
  if p_profile_id is null then
    raise exception 'Select a personnel member';
  end if;
  if p_leave_type not in ('Personal','Medical','Military','Family','Administrative','Other') then
    raise exception 'Invalid leave type';
  end if;
  if p_starts_on is null or p_expected_return_on is null or p_expected_return_on < p_starts_on then
    raise exception 'Expected return date must be on or after the LOA start date';
  end if;

  select * into v_target
  from public.personnel_profiles p
  where p.id = p_profile_id
  for update;

  if v_target.id is null or v_target.status = 'Deactivated' or v_target.is_test_account then
    raise exception 'Personnel member is unavailable for LOA administration';
  end if;

  if exists (
    select 1
    from public.leave_requests lr
    where lr.profile_id = p_profile_id
      and lr.status = 'Approved'
      and daterange(lr.starts_on, lr.expected_return_on, '[]') && daterange(p_starts_on, p_expected_return_on, '[]')
  ) then
    raise exception 'This personnel member already has an approved LOA overlapping those dates';
  end if;

  insert into public.leave_requests(
    profile_id,
    leave_type,
    starts_on,
    expected_return_on,
    notes,
    status,
    reviewed_by,
    review_notes,
    reviewed_at
  ) values (
    p_profile_id,
    p_leave_type,
    p_starts_on,
    p_expected_return_on,
    nullif(trim(coalesce(p_notes, '')), ''),
    'Approved',
    v_caller,
    'Administrative LOA recorded directly from Personnel Roster by ' || v_rank || '.',
    now()
  ) returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.roster_end_personnel_leave(
  p_profile_id uuid,
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
  v_leave public.leave_requests%rowtype;
  v_result public.leave_requests;
  v_status text;
  v_note text := nullif(trim(coalesce(p_notes, '')), '');
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;
  if v_rank not in ('Sheriff','Undersheriff','Major') then
    raise exception 'Executive personnel administration authority required';
  end if;

  select * into v_leave
  from public.leave_requests lr
  where lr.profile_id = p_profile_id
    and lr.status = 'Approved'
    and lr.expected_return_on >= current_date
  order by
    case when current_date between lr.starts_on and lr.expected_return_on then 0 else 1 end,
    lr.starts_on
  limit 1
  for update;

  if v_leave.id is null then
    raise exception 'No active or upcoming approved LOA was found for this personnel member';
  end if;

  v_status := case when v_leave.starts_on > current_date then 'Cancelled' else 'Completed' end;

  update public.leave_requests lr
  set status = v_status,
      reviewed_by = v_caller,
      reviewed_at = now(),
      review_notes = concat_ws(E'\n', nullif(trim(coalesce(lr.review_notes, '')), ''), 'Administrative ' || lower(v_status) || ' action recorded from Personnel Roster by ' || v_rank || case when v_note is not null then ': ' || v_note else '.' end),
      updated_at = now()
  where lr.id = v_leave.id
  returning lr.* into v_result;

  return v_result;
end;
$$;

revoke all on function public.roster_record_personnel_leave(uuid,text,date,date,text) from public, anon;
revoke all on function public.roster_end_personnel_leave(uuid,text) from public, anon;
grant execute on function public.roster_record_personnel_leave(uuid,text,date,date,text) to authenticated, service_role;
grant execute on function public.roster_end_personnel_leave(uuid,text) to authenticated, service_role;

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
        'LOA-' || lpad(new.request_number::text,4,'0') || ' was approved and recorded for ' || to_char(new.starts_on, 'Mon DD, YYYY') || ' through ' || to_char(new.expected_return_on, 'Mon DD, YYYY') || '.',
        '/portal/my-office#requests'
      );
    else
      insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
      values(new.profile_id,'Leave Request','LOA request submitted','LOA-' || lpad(new.request_number::text,4,'0') || ' was submitted for review.','/portal/my-office#requests');
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
$$;

revoke all on function app_private.notify_leave_status() from public, anon, authenticated;
grant execute on function app_private.notify_leave_status() to postgres, service_role;
