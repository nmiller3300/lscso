-- Audited post-creation personnel identity management.
-- Rank drives access tier so profile authority cannot drift into invalid combinations.

create or replace function app_private.rank_access_tier(p_rank text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_rank
    when 'Sheriff' then 'Executive'
    when 'Undersheriff' then 'Executive'
    when 'Major' then 'Command'
    when 'Captain' then 'Command'
    when '1st Lieutenant' then 'Command'
    when 'Lieutenant' then 'Supervisor'
    when 'Sergeant' then 'Supervisor'
    when 'Corporal' then 'Preliminary'
    when 'Master Deputy' then 'Deputy'
    when 'Deputy III' then 'Deputy'
    when 'Deputy II' then 'Deputy'
    when 'Deputy' then 'Deputy'
    when 'Recruit' then 'Deputy'
    else null
  end
$$;

create or replace function app_private.rank_level(p_rank text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_rank
    when 'Sheriff' then 130
    when 'Undersheriff' then 120
    when 'Major' then 110
    when 'Captain' then 100
    when '1st Lieutenant' then 90
    when 'Lieutenant' then 80
    when 'Sergeant' then 70
    when 'Corporal' then 60
    when 'Master Deputy' then 50
    when 'Deputy III' then 40
    when 'Deputy II' then 30
    when 'Deputy' then 20
    when 'Recruit' then 10
    else null
  end
$$;

create or replace function public.v2_update_personnel_identity(
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
  v_actor uuid := app_private.current_profile_id();
  v_old public.personnel_profiles;
  v_result public.personnel_profiles;
  v_new_tier text;
  v_event_type text;
  v_old_level integer;
  v_new_level integer;
begin
  if not app_private.current_is_executive() then
    raise exception 'Executive authority required';
  end if;

  v_new_tier := app_private.rank_access_tier(p_rank);
  if v_new_tier is null then raise exception 'Invalid rank'; end if;
  if p_status not in ('Active','Acting','Suspended','Deactivated') then raise exception 'Invalid status'; end if;

  select * into v_old from public.personnel_profiles where id = p_profile_id;
  if v_old.id is null then raise exception 'Personnel profile not found'; end if;

  -- Never let an Executive accidentally demote/deactivate themselves through this workflow.
  if v_old.id = v_actor and (p_rank <> v_old.rank or p_status <> v_old.status) then
    raise exception 'Executive personnel cannot change their own rank or status';
  end if;

  update public.personnel_profiles as pp
  set rank = p_rank,
      access_tier = v_new_tier,
      status = p_status,
      updated_at = now()
  where pp.id = p_profile_id
  returning * into v_result;

  if v_old.rank is distinct from p_rank then
    v_old_level := app_private.rank_level(v_old.rank);
    v_new_level := app_private.rank_level(p_rank);
    v_event_type := case
      when v_new_level > v_old_level then 'Promotion'
      when v_new_level < v_old_level then 'Demotion'
      else 'Rank Correction'
    end;

    insert into public.personnel_career_events(
      profile_id,event_type,effective_at,from_rank,to_rank,title,notes,recorded_by
    ) values (
      p_profile_id,v_event_type,now(),v_old.rank,p_rank,
      v_event_type || ': ' || v_old.rank || ' to ' || p_rank,
      nullif(trim(coalesce(p_reason,'')),''),v_actor
    );
  end if;

  insert into public.audit_log(actor_user_id, actor_profile_id, action, table_name, record_id, old_data, new_data)
  values (
    (select auth.uid()), v_actor, 'V2_UPDATE_PERSONNEL_IDENTITY', 'personnel_profiles', p_profile_id::text,
    jsonb_build_object('rank',v_old.rank,'access_tier',v_old.access_tier,'status',v_old.status),
    jsonb_build_object('rank',v_result.rank,'access_tier',v_result.access_tier,'status',v_result.status,'reason',nullif(trim(coalesce(p_reason,'')),''))
  );

  return v_result;
end;
$$;

revoke all on function public.v2_update_personnel_identity(uuid,text,text,text) from public, anon;
grant execute on function public.v2_update_personnel_identity(uuid,text,text,text) to authenticated;
