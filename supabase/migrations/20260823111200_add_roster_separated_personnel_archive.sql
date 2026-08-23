create or replace function public.get_roster_separated_personnel()
returns table(
  profile_id uuid,
  personnel_id text,
  display_name text,
  rank text,
  username text,
  deactivated_at timestamptz,
  last_call_sign text,
  last_assignment text,
  separation_title text,
  separation_notes text
)
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if app_private.current_profile_id() is null then raise exception 'Authentication required'; end if;
  if not (
    app_private.current_is_roster_leadership()
    or app_private.current_has_active_delegation('Personnel Administration')
    or app_private.current_has_active_delegation('Temporary Command Authority')
  ) then raise exception 'Personnel administration authority required'; end if;

  return query
  select
    p.id,
    p.personnel_id,
    p.display_name,
    p.rank,
    p.username,
    p.deactivated_at,
    last_call.call_sign,
    last_unit.name,
    separation.title,
    separation.notes
  from public.personnel_profiles p
  left join lateral (
    select csa.call_sign
    from public.call_sign_assignments csa
    where csa.profile_id=p.id
    order by coalesce(csa.released_at,csa.assigned_at) desc
    limit 1
  ) last_call on true
  left join lateral (
    select ou.name
    from public.personnel_unit_assignments pua
    join public.organizational_units ou on ou.id=pua.organizational_unit_id
    where pua.profile_id=p.id
    order by coalesce(pua.ends_at,pua.starts_at) desc
    limit 1
  ) last_unit on true
  left join lateral (
    select ce.title,ce.notes
    from public.personnel_career_events ce
    where ce.profile_id=p.id and ce.event_type='Separation'
    order by ce.effective_at desc
    limit 1
  ) separation on true
  where p.status='Deactivated' and not p.is_test_account
  order by p.deactivated_at desc nulls last,p.display_name;
end
$$;

revoke all on function public.get_roster_separated_personnel() from public;
grant execute on function public.get_roster_separated_personnel() to authenticated;
