create or replace function public.roster_update_personnel_rank_status(p_profile_id uuid, p_rank text, p_status text, p_reason text default null::text)
returns public.personnel_profiles
language plpgsql
security definer
set search_path to ''
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

  return v_result;
end
$$;
