drop trigger if exists recruitment_protected_question_fields on public.recruitment_application_questions;
drop function if exists app_private.enforce_recruitment_protected_question_fields();

update public.recruitment_application_questions
set locked = false,
    updated_at = now()
where question_key in ('full_name','discord_username');
