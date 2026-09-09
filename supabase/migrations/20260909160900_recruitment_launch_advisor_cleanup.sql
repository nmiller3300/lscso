-- Consolidate recruitment question SELECT policies so authenticated requests evaluate
-- one permissive policy, while anonymous visitors can only read active questions.
drop policy if exists "recruitment_questions_public_active_select" on public.recruitment_application_questions;
drop policy if exists "recruitment_questions_editor_select" on public.recruitment_application_questions;

create policy "recruitment_questions_anon_active_select"
on public.recruitment_application_questions
for select
to anon
using (active = true);

create policy "recruitment_questions_authenticated_select"
on public.recruitment_application_questions
for select
to authenticated
using (
  active = true
  or (select app_private.can_edit_recruitment_application_form())
);

create index if not exists recruitment_applications_hired_by_idx
  on public.recruitment_applications(hired_by_profile_id);