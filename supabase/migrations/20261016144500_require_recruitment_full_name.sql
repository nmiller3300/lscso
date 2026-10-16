-- Require first and last names on submission and explicit name changes.
-- Existing historical entries remain untouched. Signed names are preserved.
create or replace function app_private.require_recruitment_full_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.full_name is null
     or btrim(new.full_name) !~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+' then
    raise exception 'Please enter both your first and last character name.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists recruitment_application_full_name_required on public.recruitment_applications;
create trigger recruitment_application_full_name_required
before insert or update of full_name on public.recruitment_applications
for each row execute function app_private.require_recruitment_full_name();
