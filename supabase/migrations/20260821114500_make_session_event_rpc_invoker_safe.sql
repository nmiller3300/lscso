-- Session sign-in/out logging does not require elevated database privileges.
-- Make the RPC SECURITY INVOKER and authorize the insert with RLS.

grant insert on table public.session_events to authenticated;

drop policy if exists session_events_insert_self on public.session_events;
create policy session_events_insert_self
on public.session_events
for insert
to authenticated
with check (
  profile_id = (
    select profile.id
    from public.personnel_profiles profile
    where profile.auth_user_id = (select auth.uid())
      and profile.status in ('Active','Acting')
    limit 1
  )
  and event_type in ('Sign In','Sign Out','Password Changed')
);

create or replace function public.record_session_event(
  session_event_type text,
  session_user_agent text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_profile uuid;
  event_id uuid;
begin
  select profile.id
  into current_profile
  from public.personnel_profiles profile
  where profile.auth_user_id = (select auth.uid())
    and profile.status in ('Active','Acting')
  limit 1;

  if current_profile is null then
    raise exception 'Authorized profile required';
  end if;

  if session_event_type not in ('Sign In','Sign Out','Password Changed') then
    raise exception 'This session event cannot be self-recorded';
  end if;

  insert into public.session_events (profile_id, event_type, user_agent)
  values (
    current_profile,
    session_event_type,
    left(nullif(trim(session_user_agent), ''), 500)
  )
  returning id into event_id;

  return event_id;
end;
$$;

revoke execute on function public.record_session_event(text, text) from public, anon;
grant execute on function public.record_session_event(text, text) to authenticated;
