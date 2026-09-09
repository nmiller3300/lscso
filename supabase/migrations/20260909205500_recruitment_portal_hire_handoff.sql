create or replace function public.record_recruit_hire_from_portal(
  p_application_id uuid,
  p_target_citizen_id text,
  p_target_license_identifier text default null,
  p_target_name text default null,
  p_target_server_id integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_profile_id uuid;
  v_access_tier text;
begin
  v_actor_profile_id := app_private.current_profile_id();
  v_access_tier := app_private.current_access_tier();

  if v_actor_profile_id is null or v_access_tier not in ('Executive', 'Command') then
    raise exception 'Only active Command Staff may complete a Recruit hire handoff.' using errcode = '42501';
  end if;

  return public.record_recruit_hire(
    p_application_id,
    v_actor_profile_id,
    p_target_citizen_id,
    p_target_license_identifier,
    p_target_name,
    p_target_server_id
  );
end;
$$;

revoke all on function public.record_recruit_hire_from_portal(uuid,text,text,text,integer) from public;
revoke all on function public.record_recruit_hire_from_portal(uuid,text,text,text,integer) from anon;
grant execute on function public.record_recruit_hire_from_portal(uuid,text,text,text,integer) to authenticated;
grant execute on function public.record_recruit_hire_from_portal(uuid,text,text,text,integer) to service_role;
