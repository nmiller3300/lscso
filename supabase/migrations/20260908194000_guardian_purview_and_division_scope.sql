create or replace function app_private.unit_is_within_scope(p_unit_id uuid, p_scope_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive ancestors as (
    select u.id, u.parent_unit_id
    from public.organizational_units u
    where u.id = p_unit_id
      and u.active
    union
    select parent.id, parent.parent_unit_id
    from public.organizational_units parent
    join ancestors child on child.parent_unit_id = parent.id
    where parent.active
  )
  select coalesce(exists(select 1 from ancestors where id = p_scope_unit_id), false)
$$;

create or replace function app_private.current_can_manage_roster_assignments(p_unit_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    app_private.current_is_roster_leadership()
    or app_private.current_has_active_delegation('Personnel Administration')
    or app_private.current_has_active_delegation('Temporary Command Authority')
    or (
      p_unit_id is not null
      and exists (
        select 1
        from public.personnel_delegations d
        where d.profile_id = app_private.current_profile_id()
          and d.delegation_type = 'Division Administration'
          and d.organizational_unit_id is not null
          and d.starts_at <= now()
          and d.revoked_at is null
          and (d.expires_at is null or d.expires_at > now())
          and app_private.unit_is_within_scope(p_unit_id, d.organizational_unit_id)
      )
    ),
    false
  )
$$;

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
set search_path = ''
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

revoke all on function public.get_personnel_in_my_purview() from public, anon;
grant execute on function public.get_personnel_in_my_purview() to authenticated, service_role;

create or replace function app_private.current_can_guardian_subject(p_target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    app_private.current_access_tier() in ('Executive','Command','Supervisor','Preliminary')
    and p_target_profile_id is not null
    and p_target_profile_id <> app_private.current_profile_id()
    and exists (
      select 1
      from public.get_personnel_in_my_purview() purview
      where purview.profile_id = p_target_profile_id
    ),
    false
  )
$$;

create or replace function public.get_guardian_point_total(target_profile_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  total integer;
begin
  if not app_private.current_can_guardian_subject(target_profile_id) then
    raise exception 'Guardian authority over this personnel member is required';
  end if;

  select coalesce(sum(record.points_assessed), 0)::integer
  into total
  from public.guardian_records record
  where record.subject_profile_id = target_profile_id
    and record.record_type <> 'Commendation'
    and record.status in (
      'Approved',
      'Issued',
      'Awaiting Acknowledgment',
      'Acknowledged',
      'Follow-Up Due',
      'Closed'
    );

  return total;
end;
$$;

revoke all on function public.get_guardian_point_total(uuid) from public, anon;
grant execute on function public.get_guardian_point_total(uuid) to authenticated, service_role;

drop policy if exists guardian_records_insert on public.guardian_records;
create policy guardian_records_insert
on public.guardian_records
for insert
to authenticated
with check (
  author_profile_id = app_private.current_profile_id()
  and app_private.current_can_guardian_subject(subject_profile_id)
);

drop policy if exists guardian_records_select on public.guardian_records;
create policy guardian_records_select
on public.guardian_records
for select
to authenticated
using (
  (
    subject_profile_id = app_private.current_profile_id()
    and status in ('Issued','Awaiting Acknowledgment','Acknowledged','Follow-Up Due','Closed')
  )
  or author_profile_id = app_private.current_profile_id()
  or app_private.current_access_tier() in ('Executive','Command')
  or (
    status in ('Approved','Issued','Awaiting Acknowledgment','Acknowledged','Follow-Up Due','Closed')
    and app_private.current_can_guardian_subject(subject_profile_id)
  )
);

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
begin
  return public.roster_assign_personnel_to_unit(p_profile_id, p_unit_id, p_assignment_type, p_notes);
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
begin
  perform public.roster_end_personnel_assignment(p_assignment_id, p_reason);
end;
$$;

revoke all on function public.v2_assign_personnel_to_unit(uuid,uuid,text,text) from public, anon;
grant execute on function public.v2_assign_personnel_to_unit(uuid,uuid,text,text) to authenticated, service_role;
revoke all on function public.v2_end_personnel_assignment(uuid,text) from public, anon;
grant execute on function public.v2_end_personnel_assignment(uuid,text) to authenticated, service_role;
