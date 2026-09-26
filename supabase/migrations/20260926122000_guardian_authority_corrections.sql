-- Align Guardian authoring authority with department policy.
-- Supervisors may issue Feedback and Written Warnings directly.
-- Write-Ups must enter Command review before they can be issued.
-- Commendations may only be authored by Command/Executive personnel.

drop policy if exists guardian_records_insert on public.guardian_records;

create policy guardian_records_insert
on public.guardian_records
for insert
to authenticated
with check (
  author_profile_id = app_private.current_profile_id()
  and app_private.current_can_guardian_subject(subject_profile_id)
  and (
    record_type <> 'Commendation'
    or app_private.current_access_tier() in ('Executive', 'Command')
  )
  and (
    record_type <> 'Write-Up'
    or status in ('Draft', 'Pending Approval')
  )
);
