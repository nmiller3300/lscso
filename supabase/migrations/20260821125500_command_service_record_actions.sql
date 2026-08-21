create or replace function public.issue_personnel_award(
  target_profile_id uuid,
  award_type text,
  citation_text text,
  award_date date default current_date,
  asset_path text default null
)
returns public.personnel_awards
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := app_private.current_profile_id();
  tier text := app_private.current_access_tier();
  result public.personnel_awards;
begin
  if caller is null or tier not in ('Executive','Command') then raise exception 'Command authority required'; end if;
  if award_type not in ('Medal of Valor','Medal of Merit','Life Saving Award','Distinguished Service Award','Deputy of the Month') then raise exception 'Award is not in the approved LSCSO awards catalog'; end if;
  if length(trim(coalesce(citation_text,''))) < 10 then raise exception 'An award citation is required'; end if;
  if not exists (select 1 from public.personnel_profiles p where p.id=target_profile_id and p.status <> 'Deactivated') then raise exception 'Personnel profile is unavailable'; end if;
  insert into public.personnel_awards(profile_id,award_name,citation,awarded_by,awarded_on,image_asset_path)
  values(target_profile_id,award_type,trim(citation_text),caller,award_date,nullif(trim(asset_path),'')) returning * into result;
  return result;
end; $$;

create or replace function public.add_personnel_flag(target_profile_id uuid, flag_name text, flag_notes text default null)
returns public.personnel_flags
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := app_private.current_profile_id();
  tier text := app_private.current_access_tier();
  result public.personnel_flags;
begin
  if caller is null or tier not in ('Executive','Command') then raise exception 'Command authority required'; end if;
  if flag_name not in ('Promotion Eligible','Promotion Hold','Training Required','Certification Deficiency','Administrative Review','Probationary','FTO Eligible','Supervisor Eligible','Command Review Required','Return From LOA Review','Restricted Duty','Separation Pending') then raise exception 'Unsupported personnel flag'; end if;
  if exists(select 1 from public.personnel_flags f where f.profile_id=target_profile_id and f.flag_type=flag_name and f.active) then raise exception 'This personnel flag is already active'; end if;
  insert into public.personnel_flags(profile_id,flag_type,notes,created_by)
  values(target_profile_id,flag_name,nullif(trim(flag_notes),''),caller) returning * into result;
  return result;
end; $$;

create or replace function public.resolve_personnel_flag(flag_id uuid, resolution_notes text default null)
returns public.personnel_flags
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := app_private.current_profile_id();
  tier text := app_private.current_access_tier();
  result public.personnel_flags;
begin
  if caller is null or tier not in ('Executive','Command') then raise exception 'Command authority required'; end if;
  update public.personnel_flags
  set active=false,resolved_by=caller,resolved_at=now(),notes=case when nullif(trim(resolution_notes),'') is null then notes else concat_ws(E'\n',notes,'Resolution: ' || trim(resolution_notes)) end
  where id=flag_id and active=true returning * into result;
  if result.id is null then raise exception 'Personnel flag is unavailable or already resolved'; end if;
  return result;
end; $$;

revoke all on function public.issue_personnel_award(uuid,text,text,date,text), public.add_personnel_flag(uuid,text,text), public.resolve_personnel_flag(uuid,text) from public, anon;
grant execute on function public.issue_personnel_award(uuid,text,text,date,text), public.add_personnel_flag(uuid,text,text), public.resolve_personnel_flag(uuid,text) to authenticated, service_role;

create trigger personnel_awards_audit after insert or delete or update on public.personnel_awards for each row execute function app_private.write_audit_log();
create trigger personnel_flags_audit after insert or delete or update on public.personnel_flags for each row execute function app_private.write_audit_log();
create trigger leave_requests_audit after insert or delete or update on public.leave_requests for each row execute function app_private.write_audit_log();
create trigger disciplinary_point_events_audit after insert or delete or update on public.disciplinary_point_events for each row execute function app_private.write_audit_log();