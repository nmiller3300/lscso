create function public.record_session_event(
  session_event_type text,
  session_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile uuid := app_private.current_profile_id();
  event_id uuid;
begin
  if current_profile is null then
    raise exception 'Authorized profile required';
  end if;

  if session_event_type not in ('Sign In','Sign Out','Password Changed') then
    raise exception 'This session event cannot be self-recorded';
  end if;

  insert into public.session_events (profile_id, event_type, user_agent)
  values (current_profile, session_event_type, left(nullif(trim(session_user_agent), ''), 500))
  returning id into event_id;

  return event_id;
end;
$$;

revoke all on function public.record_session_event(text, text) from public, anon;
grant execute on function public.record_session_event(text, text) to authenticated;
