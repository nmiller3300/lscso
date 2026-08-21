-- Preview-only migration for Command Portal V2.
-- Depends on 20260821150000_organizational_authority_model.sql.
-- Do not apply to production until the V2 authority model is approved.

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
  with caller as (
    select p.id, p.rank
    from public.personnel_profiles p
    where p.auth_user_id = (select auth.uid())
    limit 1
  ),
  active_assignments as (
    select a.profile_id, a.organizational_unit_id, a.assignment_type
    from public.personnel_unit_assignments a
    where a.starts_at <= now()
      and (a.ends_at is null or a.ends_at > now())
  )
  select distinct
    target.id,
    target.personnel_id,
    target.display_name,
    target.rank,
    target.call_sign,
    target.status,
    assignment.organizational_unit_id,
    unit.name,
    assignment.assignment_type,
    scopes.scope,
    scopes.authority_type
  from public.personnel_profiles target
  cross join caller c
  join lateral public.get_personnel_authority_scopes(target.id) scopes on true
  left join active_assignments assignment on assignment.profile_id = target.id
  left join public.organizational_units unit on unit.id = assignment.organizational_unit_id
  where target.id <> c.id
    and target.status <> 'Deactivated'
    and scopes.scope <> 'self'
  order by target.display_name, unit.name nulls last;
$$;

revoke all on function public.get_personnel_in_my_purview() from public;
grant execute on function public.get_personnel_in_my_purview() to authenticated;

comment on function public.get_personnel_in_my_purview() is
'Permission-aware personnel discovery for Command Portal V2. Returns each active authority path so overlapping assignments remain visible instead of collapsing to one supervisor.';
