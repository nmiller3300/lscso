alter table public.leave_requests drop constraint if exists leave_requests_leave_type_check;
alter table public.leave_requests add constraint leave_requests_leave_type_check check (leave_type = any (array['Personal'::text,'Medical'::text,'Military'::text,'Family'::text,'Paternity'::text,'Maternity'::text,'Administrative'::text,'Other'::text]));

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
  if p_leave_type not in ('Personal','Medical','Military','Family','Paternity','Maternity','Administrative','Other') then raise exception 'Invalid leave type'; end if;
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
    case when p_expected_return_on is null then 'Administrative open-ended LOA recorded directly from Personnel Roster by ' || v_rank || '; remains active until manually ended.' else 'Administrative LOA recorded directly from Personnel Roster by ' || v_rank || '.' end,
    now()
  ) returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.submit_leave_request(
  leave_kind text,
  leave_starts_on date,
  leave_expected_return_on date,
  leave_notes text default null
)
returns public.leave_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := app_private.current_profile_id();
  caller_rank text;
  result public.leave_requests;
begin
  if caller is null then raise exception 'Authorized profile required'; end if;
  select p.rank into caller_rank from public.personnel_profiles p where p.id = caller;
  if leave_kind not in ('Personal','Medical','Military','Family','Paternity','Maternity','Administrative','Other') then raise exception 'Invalid leave type'; end if;
  if leave_starts_on is null or leave_expected_return_on is null or leave_expected_return_on < leave_starts_on then raise exception 'Expected return date must be on or after the LOA start date'; end if;
  if caller_rank = 'Sheriff' then
    insert into public.leave_requests(profile_id,leave_type,starts_on,expected_return_on,notes,status,reviewed_by,review_notes,reviewed_at)
    values (caller,leave_kind,leave_starts_on,leave_expected_return_on,nullif(trim(leave_notes),''),'Approved',caller,'Sheriff self-recorded leave; no higher departmental approval required.',now()) returning * into result;
  else
    insert into public.leave_requests(profile_id,leave_type,starts_on,expected_return_on,notes,status)
    values (caller,leave_kind,leave_starts_on,leave_expected_return_on,nullif(trim(leave_notes),''),'Submitted') returning * into result;
  end if;
  return result;
end;
$$;

revoke all on function public.roster_record_personnel_leave(uuid,text,date,date,text) from public, anon;
grant execute on function public.roster_record_personnel_leave(uuid,text,date,date,text) to authenticated, service_role;
revoke all on function public.submit_leave_request(text,date,date,text) from public, anon;
grant execute on function public.submit_leave_request(text,date,date,text) to authenticated, service_role;
