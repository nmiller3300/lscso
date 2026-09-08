create table if not exists public.fivem_personnel_sync_actions (
  id uuid primary key default gen_random_uuid(),
  personnel_profile_id uuid not null references public.personnel_profiles(id) on delete cascade,
  citizen_id text not null check (char_length(citizen_id) between 2 and 100),
  desired_rank text not null check (desired_rank in (
    'Sheriff','Undersheriff','Major','Captain','1st Lieutenant','Lieutenant',
    'Sergeant','Corporal','Master Deputy','Deputy III','Deputy II','Deputy','Recruit'
  )),
  desired_grade integer not null check (desired_grade between 0 and 12),
  desired_status text not null check (desired_status in ('Active','Acting','Suspended','Deactivated')),
  reason text,
  actor_profile_id uuid references public.personnel_profiles(id) on delete set null,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists fivem_personnel_sync_pending_idx
  on public.fivem_personnel_sync_actions(next_attempt_at, created_at)
  where completed_at is null;
create index if not exists fivem_personnel_sync_profile_idx
  on public.fivem_personnel_sync_actions(personnel_profile_id, created_at desc);

alter table public.fivem_personnel_sync_actions enable row level security;
revoke all on table public.fivem_personnel_sync_actions from anon, authenticated;
grant select, insert, update, delete on table public.fivem_personnel_sync_actions to service_role;

create or replace function app_private.lscso_grade_for_rank(p_rank text)
returns integer
language sql
immutable
security invoker
set search_path = ''
as $$
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
    when 'Major' then 10
    when 'Undersheriff' then 11
    when 'Sheriff' then 12
    else null
  end;
$$;

create or replace function public.roster_update_personnel_rank_status(
  p_profile_id uuid,
  p_rank text,
  p_status text,
  p_reason text default null
)
returns public.personnel_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid:=app_private.current_profile_id();
  v_actor_rank text;
  v_temp boolean:=app_private.current_has_active_delegation('Temporary Command Authority');
  v_old public.personnel_profiles;
  v_result public.personnel_profiles;
  v_new_tier text;
  v_event_type text;
  v_old_level integer;
  v_new_level integer;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_citizen_id text;
  v_grade integer;
begin
  select rank into v_actor_rank from public.personnel_profiles where id=v_actor;
  if v_actor is null or (v_actor_rank not in ('Sheriff','Undersheriff','Major') and not v_temp) then raise exception 'Personnel change authority required'; end if;
  if v_reason is null or length(v_reason)<4 then raise exception 'Enter a short reason for the personnel change'; end if;
  v_new_tier:=app_private.rank_access_tier(p_rank);
  if v_new_tier is null then raise exception 'Invalid rank'; end if;
  if p_status not in ('Active','Acting','Suspended') then raise exception 'Roster management cannot deactivate accounts; use the protected Command Portal deactivation workflow'; end if;
  select * into v_old from public.personnel_profiles where id=p_profile_id;
  if v_old.id is null then raise exception 'Personnel profile not found'; end if;
  if v_old.status='Deactivated' then raise exception 'Deactivated personnel must be restored through the protected Executive reactivation workflow'; end if;
  if v_old.id=v_actor then raise exception 'Personnel may not change their own rank or status'; end if;
  if v_old.rank='Sheriff' or p_rank='Sheriff' then raise exception 'The Sheriff position cannot be modified through roster management'; end if;
  if v_actor_rank='Major' and (app_private.rank_level(v_old.rank)>=app_private.rank_level('Major') or app_private.rank_level(p_rank)>=app_private.rank_level('Major')) then raise exception 'Major may approve personnel changes below Major rank only'; end if;
  if v_actor_rank not in ('Sheriff','Undersheriff','Major') and (v_old.rank in ('Sheriff','Undersheriff','Major','Captain') or p_rank in ('Sheriff','Undersheriff','Major','Captain')) then raise exception 'Temporary Command Authority may manage 1st Lieutenant and below only'; end if;

  update public.personnel_profiles pp
  set rank=p_rank,access_tier=v_new_tier,status=p_status,updated_at=now()
  where pp.id=p_profile_id
  returning * into v_result;

  if v_old.rank is distinct from p_rank then
    v_old_level:=app_private.rank_level(v_old.rank);
    v_new_level:=app_private.rank_level(p_rank);
    v_event_type:=case when v_new_level>v_old_level then 'Promotion' when v_new_level<v_old_level then 'Demotion' else 'Rank Correction' end;
    insert into public.personnel_career_events(profile_id,event_type,effective_at,from_rank,to_rank,title,notes,recorded_by)
    values(p_profile_id,v_event_type,now(),v_old.rank,p_rank,v_event_type||': '||v_old.rank||' to '||p_rank,v_reason,v_actor);
  end if;

  if v_old.status is distinct from p_status then
    insert into public.personnel_career_events(profile_id,event_type,effective_at,title,notes,recorded_by)
    values(p_profile_id,'Other',now(),'Status: '||v_old.status||' to '||p_status,v_reason,v_actor);
  end if;

  insert into public.audit_log(actor_user_id,actor_profile_id,action,table_name,record_id,old_data,new_data)
  values((select auth.uid()),v_actor,'ROSTER_UPDATE_PERSONNEL','personnel_profiles',p_profile_id::text,
    jsonb_build_object('rank',v_old.rank,'access_tier',v_old.access_tier,'status',v_old.status),
    jsonb_build_object('rank',v_result.rank,'access_tier',v_result.access_tier,'status',v_result.status,'reason',v_reason));

  if v_old.rank is distinct from p_rank or v_old.status is distinct from p_status then
    select fil.citizen_id into v_citizen_id
    from public.fivem_identity_links fil
    where fil.personnel_profile_id=p_profile_id and fil.active=true
    order by fil.linked_at desc
    limit 1;

    if v_citizen_id is not null then
      v_grade:=app_private.lscso_grade_for_rank(p_rank);
      insert into public.fivem_personnel_sync_actions(
        personnel_profile_id,citizen_id,desired_rank,desired_grade,desired_status,reason,actor_profile_id
      ) values (
        p_profile_id,v_citizen_id,p_rank,v_grade,p_status,v_reason,v_actor
      );
    end if;
  end if;

  return v_result;
end
$$;

revoke execute on function app_private.lscso_grade_for_rank(text) from public, anon, authenticated;
grant execute on function app_private.lscso_grade_for_rank(text) to service_role;
