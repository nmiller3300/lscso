drop policy if exists guardian_records_select on public.guardian_records;

create policy guardian_records_select on public.guardian_records
for select to authenticated
using (
  (
    subject_profile_id = (select app_private.current_profile_id())
    and status in ('Issued','Awaiting Acknowledgment','Acknowledged','Follow-Up Due','Closed')
  )
  or author_profile_id = (select app_private.current_profile_id())
  or (select app_private.current_access_tier()) in ('Executive','Command')
);
