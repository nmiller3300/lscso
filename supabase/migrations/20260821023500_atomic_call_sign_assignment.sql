create function public.admin_assign_call_sign(
  target_profile_id uuid,
  new_call_sign text,
  actor_profile_id uuid,
  assignment_reason text default 'Command reassignment'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.personnel_profiles;
  normalized_call_sign text := upper(trim(new_call_sign));
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if normalized_call_sign !~ '^S-4[0-9]{2}$' then
    raise exception 'Call sign must use S-4##';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(normalized_call_sign, 0));

  select * into target
  from public.personnel_profiles
  where id = target_profile_id
  for update;

  if target.id is null then
    raise exception 'Personnel profile not found';
  end if;

  if target.status = 'Deactivated' then
    raise exception 'Deactivated personnel cannot receive a call sign';
  end if;

  if exists (
    select 1 from public.call_sign_assignments assignment
    where assignment.call_sign = normalized_call_sign
      and assignment.released_at is null
      and assignment.profile_id <> target_profile_id
  ) then
    raise exception 'Call sign is already assigned';
  end if;

  if target.call_sign is distinct from normalized_call_sign then
    update public.call_sign_assignments
    set
      released_at = now(),
      released_by = actor_profile_id,
      release_reason = assignment_reason
    where profile_id = target_profile_id
      and released_at is null;

    update public.personnel_profiles
    set call_sign = normalized_call_sign
    where id = target_profile_id;
  end if;

  if not exists (
    select 1 from public.call_sign_assignments assignment
    where assignment.profile_id = target_profile_id
      and assignment.call_sign = normalized_call_sign
      and assignment.released_at is null
  ) then
    insert into public.call_sign_assignments (profile_id, call_sign, assigned_by)
    values (target_profile_id, normalized_call_sign, actor_profile_id);
  end if;

  return jsonb_build_object(
    'profile_id', target_profile_id,
    'call_sign', normalized_call_sign,
    'prior_call_sign', target.call_sign
  );
end;
$$;

revoke all on function public.admin_assign_call_sign(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_assign_call_sign(uuid, text, uuid, text) to service_role;
