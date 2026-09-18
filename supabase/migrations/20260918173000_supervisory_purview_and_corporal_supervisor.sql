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
    when 'Corporal' then 'Supervisor'
    when 'Master Deputy' then 'Deputy'
    when 'Deputy III' then 'Deputy'
    when 'Deputy II' then 'Deputy'
    when 'Deputy' then 'Deputy'
    when 'Recruit' then 'Deputy'
    when 'Department Attorney' then 'Attorney'
    else null end
$$;

create or replace function app_private.sync_personnel_access_tier_from_rank()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_expected text;
begin
  v_expected := app_private.rank_access_tier(new.rank);
  if v_expected is null then
    raise exception 'Unsupported personnel rank: %', new.rank;
  end if;
  new.access_tier := v_expected;
  return new;
end;
$$;

drop trigger if exists personnel_profiles_sync_rank_access_tier on public.personnel_profiles;
create trigger personnel_profiles_sync_rank_access_tier
before insert or update of rank, access_tier on public.personnel_profiles
for each row execute function app_private.sync_personnel_access_tier_from_rank();

update public.personnel_profiles
set access_tier = app_private.rank_access_tier(rank)
where access_tier is distinct from app_private.rank_access_tier(rank)
  and app_private.rank_access_tier(rank) is not null;

create or replace function app_private.current_can_manage_supervisory_purview()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.access_tier in ('Executive','Command')
    from public.personnel_profiles p
    where p.auth_user_id = (select auth.uid())
      and p.status in ('Active','Acting')
    limit 1
  ), false)
$$;

create or replace function public.roster_assign_primary_supervisor(
  p_subject_profile_id uuid,
  p_supervisor_profile_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
  v_subject public.personnel_profiles%rowtype;
  v_supervisor public.personnel_profiles%rowtype;
  v_existing uuid;
  v_id uuid;
  v_reason text := trim(coalesce(p_reason, ''));
  v_subject_level int;
  v_supervisor_level int;
begin
  if v_actor is null or not app_private.current_can_manage_supervisory_purview() then
    raise exception 'Command authority required to manage supervisory purview';
  end if;

  if length(v_reason) < 4 then
    raise exception 'A documented assignment reason is required';
  end if;

  if p_subject_profile_id is null or p_supervisor_profile_id is null then
    raise exception 'Personnel member and supervisor are required';
  end if;

  if p_subject_profile_id = p_supervisor_profile_id then
    raise exception 'Personnel cannot supervise themselves';
  end if;

  select * into v_subject
  from public.personnel_profiles
  where id = p_subject_profile_id and status <> 'Deactivated';
  if not found then raise exception 'Personnel member not found'; end if;

  select * into v_supervisor
  from public.personnel_profiles
  where id = p_supervisor_profile_id and status in ('Active','Acting');
  if not found then raise exception 'Supervisor not found or is not active'; end if;

  if v_subject.rank = 'Department Attorney' then
    raise exception 'Department Attorney personnel do not use the sworn supervisory purview chain';
  end if;

  if v_supervisor.rank not in ('Sheriff','Undersheriff','Major','Captain','1st Lieutenant','Lieutenant','Sergeant','Corporal') then
    raise exception 'Selected member does not hold a supervisory rank';
  end if;

  v_subject_level := case v_subject.rank
    when 'Sheriff' then 130 when 'Undersheriff' then 120 when 'Major' then 110
    when 'Captain' then 100 when '1st Lieutenant' then 90 when 'Lieutenant' then 80
    when 'Sergeant' then 70 when 'Corporal' then 60 when 'Master Deputy' then 50
    when 'Deputy III' then 40 when 'Deputy II' then 30 when 'Deputy' then 20
    when 'Recruit' then 10 else 0 end;
  v_supervisor_level := case v_supervisor.rank
    when 'Sheriff' then 130 when 'Undersheriff' then 120 when 'Major' then 110
    when 'Captain' then 100 when '1st Lieutenant' then 90 when 'Lieutenant' then 80
    when 'Sergeant' then 70 when 'Corporal' then 60 else 0 end;

  if v_supervisor_level <= v_subject_level then
    raise exception 'Primary supervisor must outrank the assigned personnel member';
  end if;

  select sa.id into v_existing
  from public.supervisory_authorities sa
  where sa.subject_profile_id = p_subject_profile_id
    and sa.supervisor_profile_id = p_supervisor_profile_id
    and sa.authority_type = 'Primary'
    and sa.ends_at is null
  limit 1;

  if v_existing is not null then
    update public.personnel_profiles
    set supervisor_label = concat(v_supervisor.rank, ' ', v_supervisor.display_name), updated_at = now()
    where id = p_subject_profile_id;
    return v_existing;
  end if;

  update public.supervisory_authorities
  set ends_at = now(), ended_by = v_actor
  where subject_profile_id = p_subject_profile_id
    and authority_type = 'Primary'
    and ends_at is null;

  insert into public.supervisory_authorities(
    supervisor_profile_id, authority_type, subject_profile_id, granted_by, reason
  ) values (
    p_supervisor_profile_id, 'Primary', p_subject_profile_id, v_actor, v_reason
  ) returning id into v_id;

  update public.personnel_profiles
  set supervisor_label = concat(v_supervisor.rank, ' ', v_supervisor.display_name), updated_at = now()
  where id = p_subject_profile_id;

  insert into public.audit_log(actor_user_id, actor_profile_id, action, table_name, record_id, new_data)
  values (
    (select auth.uid()), v_actor, 'ASSIGN_PRIMARY_SUPERVISOR', 'supervisory_authorities', v_id::text,
    jsonb_build_object(
      'subject_profile_id', p_subject_profile_id,
      'supervisor_profile_id', p_supervisor_profile_id,
      'supervisor_rank', v_supervisor.rank,
      'reason', v_reason
    )
  );

  return v_id;
end;
$$;

create or replace function public.roster_remove_primary_supervisor(
  p_subject_profile_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
  v_reason text := trim(coalesce(p_reason, ''));
  v_old jsonb;
begin
  if v_actor is null or not app_private.current_can_manage_supervisory_purview() then
    raise exception 'Command authority required to manage supervisory purview';
  end if;

  if length(v_reason) < 4 then
    raise exception 'A documented removal reason is required';
  end if;

  select jsonb_agg(to_jsonb(sa)) into v_old
  from public.supervisory_authorities sa
  where sa.subject_profile_id = p_subject_profile_id
    and sa.authority_type = 'Primary'
    and sa.ends_at is null;

  if v_old is null then
    raise exception 'No active primary supervisor is assigned to this member';
  end if;

  update public.supervisory_authorities
  set ends_at = now(), ended_by = v_actor
  where subject_profile_id = p_subject_profile_id
    and authority_type = 'Primary'
    and ends_at is null;

  update public.personnel_profiles
  set supervisor_label = 'Pending command assignment', updated_at = now()
  where id = p_subject_profile_id;

  insert into public.audit_log(actor_user_id, actor_profile_id, action, table_name, record_id, old_data, new_data)
  values (
    (select auth.uid()), v_actor, 'REMOVE_PRIMARY_SUPERVISOR', 'supervisory_authorities', p_subject_profile_id::text,
    v_old,
    jsonb_build_object('subject_profile_id', p_subject_profile_id, 'reason', v_reason)
  );
end;
$$;

revoke all on function public.roster_assign_primary_supervisor(uuid, uuid, text) from public;
revoke all on function public.roster_remove_primary_supervisor(uuid, text) from public;
grant execute on function public.roster_assign_primary_supervisor(uuid, uuid, text) to authenticated;
grant execute on function public.roster_remove_primary_supervisor(uuid, text) to authenticated;
