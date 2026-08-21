create sequence if not exists public.certification_number_seq start with 1001 increment by 1 no cycle;

create unique index if not exists certifications_certificate_number_unique_idx
  on public.certifications (certificate_number)
  where certificate_number is not null;

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
  generated_certificate_number text;
begin
  if caller is null or tier not in ('Executive','Command') then raise exception 'Command authority required'; end if;
  if not exists (select 1 from public.certification_catalog c where c.name=certification_name and c.active) then raise exception 'Certification is not in the approved catalog'; end if;
  select * into caller_profile from public.personnel_profiles where id=caller;
  select * into target from public.personnel_profiles where id=target_profile_id and status <> 'Deactivated';
  if target.id is null then raise exception 'Personnel profile is unavailable'; end if;
  if expiration_date is not null and expiration_date < issued_date then raise exception 'Expiration cannot precede issuance'; end if;

  generated_certificate_number := 'LSCSO-CERT-' || lpad(nextval('public.certification_number_seq')::text, 6, '0');

  select * into result from public.certifications c
  where c.profile_id=target_profile_id and c.name=certification_name and c.status in ('Requested','Pending')
  order by c.created_at desc limit 1 for update;

  if result.id is not null then
    update public.certifications set
      issuer=caller_profile.display_name,
      certificate_number=generated_certificate_number,
      status='Current',
      issued_on=issued_date,
      expires_on=expiration_date,
      approved_by=caller,
      approved_at=now(),
      notes=coalesce(nullif(trim(issue_notes),''),notes),
      updated_at=now()
    where id=result.id returning * into result;
  else
    if exists (select 1 from public.certifications c where c.profile_id=target_profile_id and c.name=certification_name and c.status='Current') then
      raise exception 'This certification is already current';
    end if;
    insert into public.certifications(profile_id,name,issuer,certificate_number,status,issued_on,expires_on,approved_by,approved_at,notes)
    values(target_profile_id,certification_name,caller_profile.display_name,generated_certificate_number,'Current',issued_date,expiration_date,caller,now(),nullif(trim(issue_notes),''))
    returning * into result;
  end if;
  return result;
end; $function$;

comment on column public.certifications.certificate_number is 'System-generated LSCSO certification identifier. Manual values supplied by clients are ignored.';
