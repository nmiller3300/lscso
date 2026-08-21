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
  if app_private.current_profile_id() is null or app_private.current_access_tier() not in ('Executive','Command') then
    raise exception 'Command authority required';
  end if;

  if certification_names is null or cardinality(certification_names) = 0 then
    raise exception 'Select at least one certification';
  end if;

  if expiration_date is not null and expiration_date < issued_date then
    raise exception 'Expiration cannot precede issuance';
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
      expiration_date,
      issue_notes
    );
    return next issued;
  end loop;
end;
$$;

revoke all on function public.issue_certifications_bulk(uuid,text[],date,date,text) from public;
grant execute on function public.issue_certifications_bulk(uuid,text[],date,date,text) to authenticated;

create or replace function public.delete_certification(certification_id uuid)
returns public.certifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted public.certifications;
begin
  if app_private.current_profile_id() is null or app_private.current_access_tier() not in ('Executive','Command') then
    raise exception 'Command authority required';
  end if;

  delete from public.certifications
  where id = certification_id
  returning * into deleted;

  if deleted.id is null then
    raise exception 'Certification record was not found';
  end if;

  return deleted;
end;
$$;

revoke all on function public.delete_certification(uuid) from public;
grant execute on function public.delete_certification(uuid) to authenticated;
