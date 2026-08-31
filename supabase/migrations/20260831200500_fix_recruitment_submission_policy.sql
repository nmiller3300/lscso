drop policy if exists recruitment_applications_public_insert on public.recruitment_applications;

create policy recruitment_applications_public_insert
on public.recruitment_applications
for insert to anon, authenticated
with check (
  status = 'Submitted'
  and reviewer_profile_id is null
  and review_notes is null
  and decision_notes is null
  and decided_at is null
);
