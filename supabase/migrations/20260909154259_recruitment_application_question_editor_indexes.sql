create index if not exists recruitment_application_questions_active_sort_idx
  on public.recruitment_application_questions(active, sort_order, created_at);

create index if not exists recruitment_application_questions_created_by_idx
  on public.recruitment_application_questions(created_by_profile_id);

create index if not exists recruitment_application_questions_updated_by_idx
  on public.recruitment_application_questions(updated_by_profile_id);
