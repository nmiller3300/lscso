create or replace function app_private.sync_division_purview_for_profile(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_profile public.personnel_profiles%rowtype;
  v_assignment record;
  v_marker constant text := '[AUTO:PRIMARY_DIVISION]';
begin
  select * into v_profile
  from public.personnel_profiles
  where id = p_profile_id;

  if not found then
    return;
  end if;

  update public.supervisory_authorities sa
  set ends_at = now()
  where sa.supervisor_profile_id = p_profile_id
    and sa.authority_type = 'Unit'
    and sa.subject_profile_id is null
    and sa.ends_at is null
    and coalesce(sa.reason, '') like v_marker || '%'
    and (
      v_profile.status not in ('Active','Acting')
      or v_profile.rank not in ('1st Lieutenant','Lieutenant','Sergeant','Corporal')
      or not exists (
        select 1
        from public.personnel_unit_assignments a
        join public.organizational_units ou on ou.id = a.organizational_unit_id
        where a.profile_id = p_profile_id
          and a.organizational_unit_id = sa.organizational_unit_id
          and a.ends_at is null
          and a.assignment_type = 'Primary'
          and ou.active
          and ou.unit_type = 'Division'
      )
    );

  if v_profile.status not in ('Active','Acting')
     or v_profile.rank not in ('1st Lieutenant','Lieutenant','Sergeant','Corporal') then
    return;
  end if;

  for v_assignment in
    select a.organizational_unit_id, a.assigned_by, ou.name
    from public.personnel_unit_assignments a
    join public.organizational_units ou on ou.id = a.organizational_unit_id
    where a.profile_id = p_profile_id
      and a.ends_at is null
      and a.assignment_type = 'Primary'
      and ou.active
      and ou.unit_type = 'Division'
  loop
    if not exists (
      select 1
      from public.supervisory_authorities sa
      where sa.supervisor_profile_id = p_profile_id
        and sa.authority_type = 'Unit'
        and sa.organizational_unit_id = v_assignment.organizational_unit_id
        and sa.ends_at is null
    ) then
      insert into public.supervisory_authorities (
        supervisor_profile_id,
        authority_type,
        organizational_unit_id,
        subject_profile_id,
        granted_by,
        reason
      ) values (
        p_profile_id,
        'Unit',
        v_assignment.organizational_unit_id,
        null,
        v_assignment.assigned_by,
        v_marker || ' Division purview follows active Primary assignment to ' || v_assignment.name
      );
    end if;
  end loop;
end;
$$;

create or replace function app_private.sync_division_purview_after_assignment_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'DELETE' then
    perform app_private.sync_division_purview_for_profile(old.profile_id);
    return old;
  end if;

  perform app_private.sync_division_purview_for_profile(new.profile_id);
  if tg_op = 'UPDATE' and old.profile_id is distinct from new.profile_id then
    perform app_private.sync_division_purview_for_profile(old.profile_id);
  end if;
  return new;
end;
$$;

drop trigger if exists personnel_unit_assignments_sync_division_purview on public.personnel_unit_assignments;
create trigger personnel_unit_assignments_sync_division_purview
after insert or update or delete on public.personnel_unit_assignments
for each row execute function app_private.sync_division_purview_after_assignment_change();

create or replace function app_private.sync_division_purview_after_profile_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform app_private.sync_division_purview_for_profile(new.id);
  return new;
end;
$$;

drop trigger if exists personnel_profiles_sync_division_purview on public.personnel_profiles;
create trigger personnel_profiles_sync_division_purview
after insert or update of rank, status on public.personnel_profiles
for each row execute function app_private.sync_division_purview_after_profile_change();

create or replace function public.get_personnel_in_my_purview()
returns table(
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
set search_path to ''
as $$
  with recursive me as (
    select p.id, p.rank
    from public.personnel_profiles p
    where p.auth_user_id = (select auth.uid())
      and p.status in ('Active','Acting')
    limit 1
  ),
  department_rows as (
    select
      p.id as profile_id,
      p.personnel_id,
      p.display_name,
      p.rank,
      p.call_sign,
      p.status,
      a.organizational_unit_id,
      ou.name as organizational_unit_name,
      a.assignment_type,
      'department'::text as scope,
      'Standing Command'::text as authority_type
    from me
    join public.personnel_profiles p on p.id <> me.id and p.status <> 'Deactivated'
    left join public.personnel_unit_assignments a
      on a.profile_id = p.id and a.ends_at is null
    left join public.organizational_units ou
      on ou.id = a.organizational_unit_id
    where me.rank in ('Sheriff','Undersheriff','Major','Captain')
  ),
  unit_tree as (
    select sa.id authority_id, sa.supervisor_profile_id, sa.authority_type, ou.id unit_id, ou.name unit_name
    from public.supervisory_authorities sa
    join public.organizational_units ou on ou.id = sa.organizational_unit_id
    join me on me.id = sa.supervisor_profile_id
    where sa.ends_at is null
      and sa.organizational_unit_id is not null
      and ou.active
      and me.rank not in ('Sheriff','Undersheriff','Major','Captain')
    union
    select ut.authority_id, ut.supervisor_profile_id, ut.authority_type, child.id, child.name
    from unit_tree ut
    join public.organizational_units child on child.parent_unit_id = ut.unit_id
    where child.active
  ),
  scoped as (
    select
      p.id profile_id, p.personnel_id, p.display_name, p.rank, p.call_sign, p.status,
      a.organizational_unit_id, ou.name organizational_unit_name, a.assignment_type,
      case sa.authority_type
        when 'Training' then 'training'
        when 'Temporary' then 'temporary_assignment'
        when 'Conflict Reassignment' then 'conflict_reassignment'
        when 'Primary' then 'direct'
        else 'unit'
      end::text scope,
      sa.authority_type
    from public.supervisory_authorities sa
    join me on me.id = sa.supervisor_profile_id
    join public.personnel_profiles p on p.id = sa.subject_profile_id
    left join public.personnel_unit_assignments a on a.profile_id = p.id and a.ends_at is null
    left join public.organizational_units ou on ou.id = a.organizational_unit_id
    where sa.ends_at is null
      and sa.subject_profile_id is not null
      and p.id <> me.id
      and p.status <> 'Deactivated'
      and me.rank not in ('Sheriff','Undersheriff','Major','Captain')
    union
    select
      p.id, p.personnel_id, p.display_name, p.rank, p.call_sign, p.status,
      a.organizational_unit_id, ut.unit_name, a.assignment_type,
      case ut.authority_type
        when 'Training' then 'training'
        when 'Temporary' then 'temporary_assignment'
        when 'Command' then 'command_chain'
        when 'Conflict Reassignment' then 'conflict_reassignment'
        else 'unit'
      end::text,
      ut.authority_type
    from unit_tree ut
    join public.personnel_unit_assignments a on a.organizational_unit_id = ut.unit_id and a.ends_at is null
    join public.personnel_profiles p on p.id = a.profile_id
    join me on p.id <> me.id
    where p.status <> 'Deactivated'
      and p.rank <> 'Department Attorney'
      and app_private.rank_level(p.rank) < app_private.rank_level(me.rank)
    union
    select
      p.id, p.personnel_id, p.display_name, p.rank, p.call_sign, p.status,
      a.organizational_unit_id, ou.name, a.assignment_type,
      'training'::text,
      'FTO Assignment'::text
    from public.training_progress tp
    join me on tp.evaluator_profile_id = me.id
    join public.personnel_profiles p on p.id = tp.profile_id and p.id <> me.id
    left join public.personnel_unit_assignments a on a.profile_id = p.id and a.ends_at is null
    left join public.organizational_units ou on ou.id = a.organizational_unit_id
    where tp.program_type = 'FTO'
      and tp.status in ('Not Started','In Progress','Needs Improvement')
      and p.status <> 'Deactivated'
      and me.rank not in ('Sheriff','Undersheriff','Major','Captain')
  )
  select distinct * from department_rows
  union
  select distinct * from scoped
  order by display_name, organizational_unit_name nulls last
$$;

do $$
declare
  r record;
begin
  for r in select id from public.personnel_profiles loop
    perform app_private.sync_division_purview_for_profile(r.id);
  end loop;
end;
$$;