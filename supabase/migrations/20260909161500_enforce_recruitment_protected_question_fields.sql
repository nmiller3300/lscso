create or replace function app_private.enforce_recruitment_protected_question_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.locked = true then
    if new.question_key is distinct from old.question_key
       or new.system_field is distinct from old.system_field
       or new.question_type is distinct from old.question_type
       or new.locked is distinct from true
       or new.active is distinct from true
       or new.required is distinct from true then
      raise exception 'Protected recruitment identity fields must remain active, required, locked, and keep their system key and question type.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.enforce_recruitment_protected_question_fields() from public, anon, authenticated;
grant execute on function app_private.enforce_recruitment_protected_question_fields() to postgres, service_role;

drop trigger if exists recruitment_protected_question_fields on public.recruitment_application_questions;
create trigger recruitment_protected_question_fields
before update on public.recruitment_application_questions
for each row
execute function app_private.enforce_recruitment_protected_question_fields();
