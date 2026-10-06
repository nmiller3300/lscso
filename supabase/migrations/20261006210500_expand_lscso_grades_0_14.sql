-- Expand LSCSO FiveM grades to 0-14 and align rank mappings.

alter table public.fivem_identity_links
  drop constraint if exists fivem_identity_links_last_seen_grade_check;
alter table public.fivem_identity_links
  add constraint fivem_identity_links_last_seen_grade_check
  check (last_seen_grade >= 0 and last_seen_grade <= 14);

alter table public.fivem_personnel_sync_actions
  drop constraint if exists fivem_personnel_sync_actions_desired_grade_check;
alter table public.fivem_personnel_sync_actions
  add constraint fivem_personnel_sync_actions_desired_grade_check
  check (desired_grade >= 0 and desired_grade <= 14);

alter table public.fivem_personnel_sync_actions
  drop constraint if exists fivem_personnel_sync_actions_desired_rank_check;
alter table public.fivem_personnel_sync_actions
  add constraint fivem_personnel_sync_actions_desired_rank_check
  check (desired_rank = any (array[
    'Sheriff'::text,'Undersheriff'::text,'Major'::text,'DPT. Attourney'::text,
    'DPT. Associate'::text,'Captain'::text,'1st Lieutenant'::text,'Lieutenant'::text,
    'Sergeant'::text,'Corporal'::text,'Master Deputy'::text,'Deputy III'::text,
    'Deputy II'::text,'Deputy'::text,'Recruit'::text
  ]));

alter table public.personnel_profiles
  drop constraint if exists personnel_profiles_rank_check;
alter table public.personnel_profiles
  add constraint personnel_profiles_rank_check
  check (rank = any (array[
    'Sheriff'::text,'Undersheriff'::text,'Major'::text,'DPT. Attourney'::text,
    'DPT. Associate'::text,'Captain'::text,'1st Lieutenant'::text,'Lieutenant'::text,
    'Sergeant'::text,'Corporal'::text,'Master Deputy'::text,'Deputy III'::text,
    'Deputy II'::text,'Deputy'::text,'Recruit'::text,'Department Attorney'::text,
    'Forensics Specialist'::text
  ]));

create or replace function app_private.lscso_grade_for_rank(p_rank text)
returns integer
language sql
immutable
set search_path to ''
as $function$
  select case p_rank
    when 'Recruit' then 0
    when 'Deputy' then 1
    when 'Deputy II' then 2
    when 'Deputy III' then 3
    when 'Master Deputy' then 4
    when 'Corporal' then 5
    when 'Sergeant' then 6
    when 'Lieutenant' then 7
    when '1st Lieutenant' then 8
    when 'Captain' then 9
    when 'DPT. Associate' then 10
    when 'DPT. Attourney' then 11
    when 'Department Attorney' then 11
    when 'Major' then 12
    when 'Undersheriff' then 13
    when 'Sheriff' then 14
    else null
  end;
$function$;

create or replace function app_private.rank_access_tier(p_rank text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case p_rank
    when 'Sheriff' then 'Executive'
    when 'Undersheriff' then 'Executive'
    when 'Major' then 'Command'
    when 'DPT. Attourney' then 'Attorney'
    when 'DPT. Associate' then 'Attorney'
    when 'Department Attorney' then 'Attorney'
    when 'Captain' then 'Command'
    when '1st Lieutenant' then 'Command'
    when 'Lieutenant' then 'Supervisor'
    when 'Sergeant' then 'Supervisor'
    when 'Corporal' then 'Supervisor'
    when 'Master Deputy' then 'Deputy'
    when 'Deputy III' then 'Deputy'
    when 'Deputy II' then 'Deputy'
    when 'Deputy' then 'Deputy'
    when 'Recruit' then 'Deputy'
    when 'Forensics Specialist' then 'Deputy'
    else null
  end;
$function$;

create or replace function public.mobile_link_character(
  p_profile_id uuid,p_citizen_id text,p_license text,p_grade integer
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  p public.personnel_profiles;
  existing public.fivem_identity_links;
  other_link public.fivem_identity_links;
begin
  if length(p_citizen_id) not between 2 and 100
     or length(p_license) not between 2 and 160
     or p_grade not between 0 and 14
     or p_grade is null then
    raise exception 'Invalid character identity';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('lscso-pairing-v2'));

  select * into p from public.personnel_profiles where id=p_profile_id for update;
  if p.id is null or p.status not in ('Active','Acting') then
    raise exception 'Personnel account is not active';
  end if;

  select * into existing from public.fivem_identity_links where citizen_id=p_citizen_id for update;
  select * into other_link from public.fivem_identity_links where personnel_profile_id=p_profile_id and active for update;

  if other_link.id is not null and other_link.citizen_id <> p_citizen_id then
    raise exception 'This account is already linked to another character. Disconnect it on the website first.';
  end if;
  if existing.id is not null and existing.active and existing.personnel_profile_id <> p_profile_id then
    raise exception 'This character is already linked to another account';
  end if;
  if existing.id is not null and existing.active and existing.license_identifier is not null and existing.license_identifier <> p_license then
    raise exception 'Character license does not match the linked account';
  end if;

  insert into public.fivem_identity_links(
    personnel_profile_id,citizen_id,license_identifier,active,linked_by,last_seen_grade,last_seen_at
  )
  values(p_profile_id,p_citizen_id,p_license,true,p_profile_id,p_grade,now())
  on conflict(citizen_id) do update
  set personnel_profile_id=excluded.personnel_profile_id,
      license_identifier=excluded.license_identifier,
      active=true,
      linked_by=excluded.linked_by,
      last_seen_grade=excluded.last_seen_grade,
      last_seen_at=now(),
      linked_at=now(),
      updated_at=now();

  insert into public.audit_log(actor_profile_id,action,table_name,record_id,new_data)
  values(p_profile_id,'FIVEM_CHARACTER_LINKED','fivem_identity_links',p_citizen_id,jsonb_build_object('citizen_id',p_citizen_id));

  return jsonb_build_object(
    'personnelId',p.personnel_id,
    'displayName',p.display_name,
    'personnelRank',p.rank,
    'citizenId',p_citizen_id
  );
end
$function$;
