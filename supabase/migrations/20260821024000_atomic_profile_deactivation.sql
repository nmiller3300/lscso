create function public.admin_deactivate_profile(
  target_profile_id uuid,
  actor_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.personnel_profiles;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role required';
  end if;

  select * into target
  from public.personnel_profiles
  where id = target_profile_id
  for update;

  if target.id is null then
    raise exception 'Personnel profile not found';
  end if;

  if target.status = 'Deactivated' then
    raise exception 'Personnel profile is already deactivated';
  end if;

  update public.call_sign_assignments
  set
    released_at = now(),
    released_by = actor_profile_id,
    release_reason = 'Account deactivated'
  where profile_id = target_profile_id
    and released_at is null;

  update public.personnel_profiles
  set
    status = 'Deactivated',
    call_sign = null,
    deactivated_at = now(),
    deactivated_by = actor_profile_id
  where id = target_profile_id;

  return jsonb_build_object(
    'profile_id', target_profile_id,
    'auth_user_id', target.auth_user_id,
    'released_call_sign', target.call_sign
  );
end;
$$;

revoke all on function public.admin_deactivate_profile(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_deactivate_profile(uuid, uuid) to service_role;
