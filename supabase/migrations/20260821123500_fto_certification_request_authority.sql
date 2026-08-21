create or replace function app_private.can_request_certifications()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select case
    when app_private.current_access_tier() in ('Executive','Command','Supervisor','Preliminary') then true
    else exists (
      select 1 from public.certifications c
      where c.profile_id = app_private.current_profile_id()
        and c.name = 'Field Training Officer'
        and c.status = 'Current'
        and (c.expires_on is null or c.expires_on >= current_date)
    )
  end;
$$;
revoke all on function app_private.can_request_certifications() from public, anon;
grant execute on function app_private.can_request_certifications() to authenticated, service_role;

create or replace function public.can_request_certifications()
returns boolean
language sql
security definer
set search_path = ''
as $$ select app_private.can_request_certifications(); $$;
revoke all on function public.can_request_certifications() from public, anon;
grant execute on function public.can_request_certifications() to authenticated, service_role;

create or replace function public.certification_request_candidates()
returns table(id uuid, display_name text, rank text, call_sign text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app_private.can_request_certifications() then raise exception 'FTO or supervisor authority required'; end if;
  return query select p.id,p.display_name,p.rank,p.call_sign from public.personnel_profiles p where p.status in ('Active','Acting') order by p.display_name;
end; $$;
revoke all on function public.certification_request_candidates() from public, anon;
grant execute on function public.certification_request_candidates() to authenticated, service_role;

create or replace function public.request_certification(target_profile_id uuid, certification_name text, request_notes text default null)
returns public.certifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := app_private.current_profile_id();
  target public.personnel_profiles;
  created public.certifications;
begin
  if caller is null or not app_private.can_request_certifications() then raise exception 'FTO or supervisor authority required'; end if;
  if not exists (select 1 from public.certification_catalog c where c.name = certification_name and c.active) then raise exception 'Certification is not in the approved catalog'; end if;
  select * into target from public.personnel_profiles where id=target_profile_id and status <> 'Deactivated';
  if target.id is null then raise exception 'Personnel profile is unavailable'; end if;
  if exists (select 1 from public.certifications c where c.profile_id=target_profile_id and c.name=certification_name and c.status in ('Current','Requested','Pending')) then raise exception 'This certification is already current or awaiting review'; end if;
  insert into public.certifications(profile_id,name,issuer,status,requested_by,notes)
  values(target_profile_id,certification_name,'Pending Command issuance','Requested',caller,nullif(trim(request_notes),'')) returning * into created;
  return created;
end; $$;
revoke all on function public.request_certification(uuid,text,text) from public, anon;
grant execute on function public.request_certification(uuid,text,text) to authenticated, service_role;