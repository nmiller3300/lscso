drop policy if exists personnel_requests_select on public.personnel_requests;
create policy personnel_requests_select
on public.personnel_requests
for select
to authenticated
using (
  requester_profile_id = (select app_private.current_profile_id())
  or current_reviewer_profile_id = (select app_private.current_profile_id())
  or (select app_private.current_access_tier()) in ('Executive','Command')
);
