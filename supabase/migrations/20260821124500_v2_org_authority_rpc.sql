-- LSCSO V2 Command Structure RPC layer
-- Sheriff / Undersheriff control the structural write path.

create or replace function app_private.current_is_executive()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.rank in ('Sheriff','Undersheriff')
    from public.personnel_profiles p
    where p.auth_user_id = (select auth.uid())
      and p.status in ('Active','Acting')
    limit 1
  ), false)
$$;

-- Corrected recursive purview resolver.
create or replace function public.get_personnel_in_my_purview()
returns table (
  profile_id uuid,
  personnel_id text,
  display_name text,
  rank text,
  call_sign text,
  status text,
  organizational_unit_id uuid,
  organizational_unit_name text,
  assignment_type text,
  scope text,
  authority_type text
)
language sql
stable
security definer
set search_path = ''
as $$
  with recursive me as (
    select p.id, p.rank
    from public.personnel_profiles p
    where p.auth_user_id = (select auth.uid())
      and p.status in ('Active','Acting')
    limit 1
  ),
  unit_tree as (
    select sa.id as authority_id,
           sa.supervisor_profile_id,
           sa.authority_type,
           ou.id as unit_id,
           ou.name as unit_name
    from public.supervisory_authorities sa
    join public.organizational_units ou on ou.id = sa.organizational_unit_id
    join me on me.id = sa.supervisor_profile_id
    where sa.ends_at is null
      and sa.organizational_unit_id is not null
      and ou.active
    union all
    select ut.authority_id,
           ut.supervisor_profile_id,
           ut.authority_type,
           child.id,
           child.name
    from unit_tree ut
    join public.organizational_units child on child.parent_unit_id = ut.unit_id
    where child.active
  ),
  scoped as (
    select p.id as profile_id,
           p.personnel_id,
           p.display_name,
           p.rank,
           p.call_sign,
           p.status,
           a.organizational_unit_id,
           ou.name as organizational_unit_name,
           a.assignment_type,
           case sa.authority_type
             when 'Training' then 'training'
             when 'Temporary' then 'temporary_assignment'
             when 'Conflict Reassignment' then 'conflict_reassignment'
             when 'Primary' then 'direct'
             else 'unit'
           end::text as scope,
           sa.authority_type
    from public.supervisory_authorities sa
    join me on me.id = sa.supervisor_profile_id
    join public.personnel_profiles p on p.id = sa.subject_profile_id
    left join public.personnel_unit_assignments a on a.profile_id = p.id and a.ends_at is null
    left join public.organizational_units ou on ou.id = a.organizational_unit_id
    where sa.ends_at is null
      and sa.subject_profile_id is not null
      and p.status <> 'Deactivated'

    union

    select p.id,
           p.personnel_id,
           p.display_name,
           p.rank,
           p.call_sign,
           p.status,
           a.organizational_unit_id,
           ut.unit_name,
           a.assignment_type,
           case ut.authority_type
             when 'Training' then 'training'
             when 'Temporary' then 'temporary_assignment'
             when 'Command' then 'command_chain'
             when 'Primary' then 'unit'
             else 'unit'
           end::text,
           ut.authority_type
    from unit_tree ut
    join public.personnel_unit_assignments a
      on a.organizational_unit_id = ut.unit_id
     and a.ends_at is null
    join public.personnel_profiles p on p.id = a.profile_id
    where p.status <> 'Deactivated'
  )
  select distinct s.profile_id, s.personnel_id, s.display_name, s.rank, s.call_sign, s.status,
         s.organizational_unit_id, s.organizational_unit_name, s.assignment_type, s.scope, s.authority_type
  from scoped s
  order by s.display_name, s.organizational_unit_name nulls last;
$$;

revoke all on function public.get_personnel_in_my_purview() from public, anon;
grant execute on function public.get_personnel_in_my_purview() to authenticated;

create or replace function public.v2_create_organizational_unit(
  p_name text,
  p_unit_type text,
  p_parent_unit_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
  v_id uuid;
begin
  if not app_private.current_is_executive() then
    raise exception 'Executive authority required';
  end if;

  if trim(coalesce(p_name,'')) = '' then raise exception 'Unit name required'; end if;
  if p_unit_type not in ('Bureau','Division','Unit','Team','Detail','Program','Shift') then
    raise exception 'Invalid unit type';
  end if;
  if p_parent_unit_id is not null and not exists (
    select 1 from public.organizational_units where id = p_parent_unit_id and active
  ) then raise exception 'Parent unit not found'; end if;

  insert into public.organizational_units(name, unit_type, parent_unit_id, created_by)
  values (trim(p_name), p_unit_type, p_parent_unit_id, v_actor)
  returning id into v_id;

  insert into public.audit_log(actor_user_id, actor_profile_id, action, table_name, record_id, new_data)
  values ((select auth.uid()), v_actor, 'V2_CREATE_ORGANIZATIONAL_UNIT', 'organizational_units', v_id::text,
          jsonb_build_object('name',trim(p_name),'unit_type',p_unit_type,'parent_unit_id',p_parent_unit_id));
  return v_id;
end;
$$;

create or replace function public.v2_assign_personnel_to_unit(
  p_profile_id uuid,
  p_unit_id uuid,
  p_assignment_type text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
  v_id uuid;
begin
  if not app_private.current_is_executive() then raise exception 'Executive authority required'; end if;
  if p_assignment_type not in ('Primary','Secondary','Special','Temporary','Training') then raise exception 'Invalid assignment type'; end if;
  if not exists (select 1 from public.personnel_profiles where id = p_profile_id and status <> 'Deactivated') then raise exception 'Personnel not found'; end if;
  if not exists (select 1 from public.organizational_units where id = p_unit_id and active) then raise exception 'Unit not found'; end if;

  if p_assignment_type = 'Primary' then
    update public.personnel_unit_assignments
      set ends_at = now(), ended_by = v_actor, end_reason = 'Replaced by new primary assignment'
      where profile_id = p_profile_id and assignment_type = 'Primary' and ends_at is null;
  end if;

  insert into public.personnel_unit_assignments(profile_id, organizational_unit_id, assignment_type, assigned_by, notes)
  values (p_profile_id, p_unit_id, p_assignment_type, v_actor, p_notes)
  returning id into v_id;

  insert into public.audit_log(actor_user_id, actor_profile_id, action, table_name, record_id, new_data)
  values ((select auth.uid()), v_actor, 'V2_ASSIGN_PERSONNEL', 'personnel_unit_assignments', v_id::text,
          jsonb_build_object('profile_id',p_profile_id,'unit_id',p_unit_id,'assignment_type',p_assignment_type,'notes',p_notes));
  return v_id;
end;
$$;

create or replace function public.v2_end_personnel_assignment(
  p_assignment_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
  v_old jsonb;
begin
  if not app_private.current_is_executive() then raise exception 'Executive authority required'; end if;
  select to_jsonb(a) into v_old from public.personnel_unit_assignments a where a.id = p_assignment_id and a.ends_at is null;
  if v_old is null then raise exception 'Active assignment not found'; end if;

  update public.personnel_unit_assignments
    set ends_at = now(), ended_by = v_actor, end_reason = nullif(trim(coalesce(p_reason,'')),'')
    where id = p_assignment_id;

  insert into public.audit_log(actor_user_id, actor_profile_id, action, table_name, record_id, old_data, new_data)
  values ((select auth.uid()), v_actor, 'V2_END_PERSONNEL_ASSIGNMENT', 'personnel_unit_assignments', p_assignment_id::text, v_old,
          jsonb_build_object('ends_at',now(),'reason',p_reason));
end;
$$;

create or replace function public.v2_grant_supervisory_authority(
  p_supervisor_profile_id uuid,
  p_authority_type text,
  p_unit_id uuid default null,
  p_subject_profile_id uuid default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
  v_id uuid;
begin
  if not app_private.current_is_executive() then raise exception 'Executive authority required'; end if;
  if p_authority_type not in ('Primary','Unit','Command','Training','Temporary','Conflict Reassignment') then raise exception 'Invalid authority type'; end if;
  if ((p_unit_id is not null)::int + (p_subject_profile_id is not null)::int) <> 1 then raise exception 'Exactly one authority target is required'; end if;
  if p_subject_profile_id = p_supervisor_profile_id then raise exception 'Personnel cannot supervise themselves'; end if;
  if not exists (select 1 from public.personnel_profiles where id = p_supervisor_profile_id and status <> 'Deactivated') then raise exception 'Supervisor not found'; end if;
  if p_unit_id is not null and not exists (select 1 from public.organizational_units where id = p_unit_id and active) then raise exception 'Unit not found'; end if;
  if p_subject_profile_id is not null and not exists (select 1 from public.personnel_profiles where id = p_subject_profile_id and status <> 'Deactivated') then raise exception 'Subject not found'; end if;

  insert into public.supervisory_authorities(supervisor_profile_id, authority_type, organizational_unit_id, subject_profile_id, granted_by, reason)
  values (p_supervisor_profile_id, p_authority_type, p_unit_id, p_subject_profile_id, v_actor, p_reason)
  returning id into v_id;

  insert into public.audit_log(actor_user_id, actor_profile_id, action, table_name, record_id, new_data)
  values ((select auth.uid()), v_actor, 'V2_GRANT_SUPERVISORY_AUTHORITY', 'supervisory_authorities', v_id::text,
          jsonb_build_object('supervisor_profile_id',p_supervisor_profile_id,'authority_type',p_authority_type,'unit_id',p_unit_id,'subject_profile_id',p_subject_profile_id,'reason',p_reason));
  return v_id;
end;
$$;

create or replace function public.v2_end_supervisory_authority(
  p_authority_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
  v_old jsonb;
begin
  if not app_private.current_is_executive() then raise exception 'Executive authority required'; end if;
  select to_jsonb(a) into v_old from public.supervisory_authorities a where a.id = p_authority_id and a.ends_at is null;
  if v_old is null then raise exception 'Active authority not found'; end if;

  update public.supervisory_authorities
    set ends_at = now(), ended_by = v_actor, reason = coalesce(nullif(trim(coalesce(p_reason,'')),''), reason)
    where id = p_authority_id;

  insert into public.audit_log(actor_user_id, actor_profile_id, action, table_name, record_id, old_data, new_data)
  values ((select auth.uid()), v_actor, 'V2_END_SUPERVISORY_AUTHORITY', 'supervisory_authorities', p_authority_id::text, v_old,
          jsonb_build_object('ends_at',now(),'reason',p_reason));
end;
$$;

revoke all on function public.v2_create_organizational_unit(text,text,uuid) from public, anon;
revoke all on function public.v2_assign_personnel_to_unit(uuid,uuid,text,text) from public, anon;
revoke all on function public.v2_end_personnel_assignment(uuid,text) from public, anon;
revoke all on function public.v2_grant_supervisory_authority(uuid,text,uuid,uuid,text) from public, anon;
revoke all on function public.v2_end_supervisory_authority(uuid,text) from public, anon;

grant execute on function public.v2_create_organizational_unit(text,text,uuid) to authenticated;
grant execute on function public.v2_assign_personnel_to_unit(uuid,uuid,text,text) to authenticated;
grant execute on function public.v2_end_personnel_assignment(uuid,text) to authenticated;
grant execute on function public.v2_grant_supervisory_authority(uuid,text,uuid,uuid,text) to authenticated;
grant execute on function public.v2_end_supervisory_authority(uuid,text) to authenticated;
