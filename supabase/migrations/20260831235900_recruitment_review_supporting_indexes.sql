create index if not exists recruitment_application_history_actor_idx
  on public.recruitment_application_history (actor_profile_id)
  where actor_profile_id is not null;

create index if not exists recruitment_application_notes_author_idx
  on public.recruitment_application_notes (author_profile_id);

create index if not exists recruitment_applications_decided_by_idx
  on public.recruitment_applications (decided_by_profile_id)
  where decided_by_profile_id is not null;

create index if not exists recruitment_applications_interviewer_idx
  on public.recruitment_applications (interviewer_profile_id)
  where interviewer_profile_id is not null;
