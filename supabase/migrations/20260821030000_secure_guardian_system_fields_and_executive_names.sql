update public.personnel_profiles
set display_name = 'Nicholas Miller'
where personnel_id = 'LS-001'
  and rank = 'Sheriff';

update public.personnel_profiles
set display_name = 'Michael White'
where personnel_id = 'LS-002'
  and rank = 'Undersheriff';

alter table public.guardian_records
  alter column guardian_number set generated always,
  alter column author_profile_id set default app_private.current_profile_id();

create or replace function app_private.enforce_guardian_system_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile uuid := app_private.current_profile_id();
  subject_is_test boolean;
begin
  if current_profile is null then
    raise exception 'Authorized personnel profile required';
  end if;

  if tg_op = 'INSERT' then
    new.author_profile_id := current_profile;
  else
    if new.guardian_number is distinct from old.guardian_number then
      raise exception 'Guardian case numbers are system generated and immutable';
    end if;
    if new.author_profile_id is distinct from old.author_profile_id then
      raise exception 'Guardian authorship is immutable';
    end if;
    new.guardian_number := old.guardian_number;
    new.author_profile_id := old.author_profile_id;
  end if;

  select profile.is_test_account
  into subject_is_test
  from public.personnel_profiles profile
  where profile.id = new.subject_profile_id;

  if not found then
    raise exception 'Guardian subject profile was not found';
  end if;

  new.is_test_record := subject_is_test;
  return new;
end;
$$;

drop trigger if exists guardian_system_fields on public.guardian_records;
create trigger guardian_system_fields
before insert or update on public.guardian_records
for each row execute function app_private.enforce_guardian_system_fields();

comment on column public.guardian_records.guardian_number is
  'System-generated Guardian case number. Callers cannot supply or change this value.';

comment on column public.guardian_records.author_profile_id is
  'Authenticated author assigned by the database and immutable after creation.';
