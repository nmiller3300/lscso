-- Deputy of the Month is not an LSCSO medal and must not be recycled as another decoration.
-- Remove any accidental records before tightening the catalog constraint.
delete from public.personnel_awards where award_name = 'Deputy of the Month';

alter table public.personnel_awards
  drop constraint if exists personnel_awards_award_name_check;

alter table public.personnel_awards
  add constraint personnel_awards_award_name_check
  check (award_name in ('Medal of Valor','Medal of Merit','Life Saving Award','Distinguished Service Award'));

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
  if award_type not in ('Medal of Valor','Medal of Merit','Life Saving Award','Distinguished Service Award') then raise exception 'Medal is not in the approved LSCSO medals catalog'; end if;
  if length(trim(coalesce(citation_text,''))) < 10 then raise exception 'A medal citation is required'; end if;
  if not exists (select 1 from public.personnel_profiles p where p.id=target_profile_id and p.status <> 'Deactivated') then raise exception 'Personnel profile is unavailable'; end if;
  insert into public.personnel_awards(profile_id,award_name,citation,awarded_by,awarded_on,image_asset_path)
  values(target_profile_id,award_type,trim(citation_text),caller,award_date,nullif(trim(asset_path),'')) returning * into result;
  return result;
end; $$;

revoke all on function public.issue_personnel_award(uuid,text,text,date,text) from public, anon;
grant execute on function public.issue_personnel_award(uuid,text,text,date,text) to authenticated, service_role;