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
  if caller is null then
    raise exception 'Authorized profile required';
  end if;

  select p.rank into caller_rank
  from public.personnel_profiles p
  where p.id = caller;

  if leave_kind not in ('Personal','Medical','Military','Family','Administrative','Other') then
    raise exception 'Invalid leave type';
  end if;

  if leave_starts_on is null or leave_expected_return_on is null or leave_expected_return_on < leave_starts_on then
    raise exception 'Expected return date must be on or after the LOA start date';
  end if;

  if caller_rank = 'Sheriff' then
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
      caller,
      leave_kind,
      leave_starts_on,
      leave_expected_return_on,
      nullif(trim(leave_notes), ''),
      'Approved',
      caller,
      'Sheriff self-recorded leave; no higher departmental approval required.',
      now()
    ) returning * into result;
  else
    insert into public.leave_requests(
      profile_id,
      leave_type,
      starts_on,
      expected_return_on,
      notes,
      status
    ) values (
      caller,
      leave_kind,
      leave_starts_on,
      leave_expected_return_on,
      nullif(trim(leave_notes), ''),
      'Submitted'
    ) returning * into result;
  end if;

  return result;
end;
$$;

revoke all on function public.submit_leave_request(text,date,date,text) from public, anon;
grant execute on function public.submit_leave_request(text,date,date,text) to authenticated, service_role;

comment on function public.submit_leave_request(text,date,date,text) is
  'Creates an LOA for the authenticated member. Sheriff leave is self-recorded as approved because the Sheriff has no higher departmental approver; all other ranks remain submitted for normal review.';
