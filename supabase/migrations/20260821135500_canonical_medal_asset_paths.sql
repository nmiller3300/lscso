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
  canonical_asset text;
begin
  if caller is null or tier not in ('Executive','Command') then raise exception 'Command authority required'; end if;
  if award_type not in ('Medal of Valor','Medal of Merit','Life Saving Award','Distinguished Service Award') then raise exception 'Medal is not in the approved LSCSO medals catalog'; end if;
  if length(trim(coalesce(citation_text,''))) < 10 then raise exception 'A medal citation is required'; end if;
  if not exists (select 1 from public.personnel_profiles p where p.id=target_profile_id and p.status <> 'Deactivated') then raise exception 'Personnel profile is unavailable'; end if;

  canonical_asset := case award_type
    when 'Medal of Valor' then '/images/medals/medal-of-valor.png'
    when 'Medal of Merit' then '/images/medals/medal-of-merit.png'
    when 'Life Saving Award' then '/images/medals/life-saving-award.png'
    when 'Distinguished Service Award' then '/images/medals/distinguished-service-award.png'
  end;

  insert into public.personnel_awards(profile_id,award_name,citation,awarded_by,awarded_on,image_asset_path)
  values(target_profile_id,award_type,trim(citation_text),caller,award_date,canonical_asset)
  returning * into result;
  return result;
end; $$;

update public.personnel_awards
set image_asset_path = case award_name
  when 'Medal of Valor' then '/images/medals/medal-of-valor.png'
  when 'Medal of Merit' then '/images/medals/medal-of-merit.png'
  when 'Life Saving Award' then '/images/medals/life-saving-award.png'
  when 'Distinguished Service Award' then '/images/medals/distinguished-service-award.png'
  else image_asset_path end
where award_name in ('Medal of Valor','Medal of Merit','Life Saving Award','Distinguished Service Award');