alter table public.guardian_records
  add column if not exists reference_number text;

alter table public.guardian_records disable trigger guardian_system_fields;

update public.guardian_records
set reference_number = format(
  'LSCSO-GDN-%s-%s',
  to_char(created_at at time zone 'America/New_York', 'YYYY'),
  lpad(guardian_number::text, 4, '0')
)
where reference_number is null or btrim(reference_number) = '';

alter table public.guardian_records enable trigger guardian_system_fields;

alter table public.guardian_records
  alter column reference_number set not null;

create unique index if not exists guardian_records_reference_number_key
  on public.guardian_records (reference_number);

create or replace function app_private.enforce_guardian_system_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_profile uuid := app_private.current_profile_id();
  subject_is_test boolean;
begin
  if current_profile is null then
    raise exception 'Authorized personnel profile required';
  end if;

  if tg_op = 'INSERT' then
    new.author_profile_id := current_profile;
    new.reference_number := format(
      'LSCSO-GDN-%s-%s',
      to_char(coalesce(new.created_at, now()) at time zone 'America/New_York', 'YYYY'),
      lpad(new.guardian_number::text, 4, '0')
    );
  else
    if new.guardian_number is distinct from old.guardian_number then
      raise exception 'Guardian case numbers are system generated and immutable';
    end if;
    if new.reference_number is distinct from old.reference_number then
      raise exception 'Guardian reference numbers are system generated and immutable';
    end if;
    if new.author_profile_id is distinct from old.author_profile_id then
      raise exception 'Guardian authorship is immutable';
    end if;
    new.guardian_number := old.guardian_number;
    new.reference_number := old.reference_number;
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
$function$;

comment on column public.guardian_records.reference_number is
  'Immutable system-generated Guardian reference in LSCSO-GDN-YYYY-NNNN format. External CAD/case/training references remain in structured_fields.reference.';
