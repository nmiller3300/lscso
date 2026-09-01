create or replace function public.certification_expiration_date(
  certification_name text,
  issued_date date
)
returns date
language sql
immutable
set search_path = ''
as $$
  select case certification_name
    when 'CPR / AED' then issued_date + interval '1 year'
    when 'Crisis Intervention Training' then issued_date + interval '1 year'
    when 'Defensive Tactics Instructor' then issued_date + interval '2 years'
    when 'Less-Lethal Certification' then issued_date + interval '1 year'
    when 'Stop the Bleed / First Aid' then issued_date + interval '1 year'
    when 'Crisis Negotiator' then issued_date + interval '1 year'
    when 'Drug Recognition Expert' then issued_date + interval '1 year'
    when 'Firearm Certification' then issued_date + interval '2 years'
    when 'Interview & Interrogation' then issued_date + interval '1 year'
    when 'Less-Lethal Instructor' then issued_date + interval '1 year'
    when 'Taser / Conducted Energy Weapon Certification' then issued_date + interval '1 year'
    when 'De-Escalation Certification' then issued_date + interval '1 year'
    when 'EVOC Instructor' then issued_date + interval '2 years'
    when 'Firearms Instructor' then issued_date + interval '2 years'
    when 'Search & Rescue' then issued_date + interval '2 years'
    when 'SWAT Marksman' then issued_date + interval '1 year'
    else null
  end::date
$$;

create or replace function public.issue_certification(
  target_profile_id uuid,
  certification_name text,
  certificate_no text default null,
  issued_date date default current_date,
  expiration_date date default null,
  issue_notes text default null
)
returns public.certifications
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller uuid := app_private.current_profile_id();
  tier text := app_private.current_access_tier();
  caller_profile public.personnel_profiles;
  target public.personnel_profiles;
  result public.certifications;
  policy_expiration date;
begin
  if caller is null or tier not in ('Executive','Command') then
    raise exception 'Command authority required';
  end if;

  if not exists (
    select 1 from public.certification_catalog c
    where c.name = certification_name and c.active
  ) then
    raise exception 'Certification is not in the approved catalog';
  end if;

  select * into caller_profile from public.personnel_profiles where id = caller;
  select * into target from public.personnel_profiles
  where id = target_profile_id and status <> 'Deactivated';

  if target.id is null then
    raise exception 'Personnel profile is unavailable';
  end if;

  policy_expiration := public.certification_expiration_date(certification_name, issued_date);

  select * into result
  from public.certifications c
  where c.profile_id = target_profile_id
    and c.name = certification_name
    and c.status in ('Requested','Pending')
  order by c.created_at desc
  limit 1
  for update;

  if result.id is not null then
    update public.certifications set
      issuer = caller_profile.display_name,
      certificate_number = 'LSCSO-CERT-' || lpad(nextval('public.certification_number_seq')::text, 6, '0'),
      status = 'Current',
      issued_on = issued_date,
      expires_on = policy_expiration,
      approved_by = caller,
      approved_at = now(),
      notes = coalesce(nullif(trim(issue_notes),''), notes),
      updated_at = now()
    where id = result.id
    returning * into result;
  else
    if exists (
      select 1 from public.certifications c
      where c.profile_id = target_profile_id
        and c.name = certification_name
        and c.status = 'Current'
    ) then
      raise exception 'This certification is already current';
    end if;

    insert into public.certifications(
      profile_id,name,issuer,certificate_number,status,issued_on,expires_on,
      approved_by,approved_at,notes
    ) values (
      target_profile_id,
      certification_name,
      caller_profile.display_name,
      'LSCSO-CERT-' || lpad(nextval('public.certification_number_seq')::text, 6, '0'),
      'Current',
      issued_date,
      policy_expiration,
      caller,
      now(),
      nullif(trim(issue_notes),'')
    ) returning * into result;
  end if;

  return result;
end;
$function$;

create or replace function public.issue_certifications_bulk(
  target_profile_id uuid,
  certification_names text[],
  issued_date date default current_date,
  expiration_date date default null,
  issue_notes text default null
)
returns setof public.certifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  certification_name text;
  issued public.certifications;
begin
  if app_private.current_profile_id() is null
    or app_private.current_access_tier() not in ('Executive','Command') then
    raise exception 'Command authority required';
  end if;

  if certification_names is null or cardinality(certification_names) = 0 then
    raise exception 'Select at least one certification';
  end if;

  foreach certification_name in array certification_names loop
    if certification_name is null or btrim(certification_name) = '' then
      raise exception 'Certification name cannot be blank';
    end if;

    issued := public.issue_certification(
      target_profile_id,
      certification_name,
      null,
      issued_date,
      null,
      issue_notes
    );
    return next issued;
  end loop;
end;
$$;

revoke all on function public.certification_expiration_date(text,date) from public, anon, authenticated;
grant execute on function public.certification_expiration_date(text,date) to authenticated;
revoke all on function public.issue_certifications_bulk(uuid,text[],date,date,text) from public, anon;
grant execute on function public.issue_certifications_bulk(uuid,text[],date,date,text) to authenticated;
