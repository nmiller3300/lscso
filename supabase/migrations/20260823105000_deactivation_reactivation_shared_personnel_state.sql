create or replace function public.admin_deactivate_profile(target_profile_id uuid, actor_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
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

  if target.id is null then raise exception 'Personnel profile not found'; end if;
  if target.status = 'Deactivated' then raise exception 'Personnel profile is already deactivated'; end if;

  update public.call_sign_assignments
  set released_at = now(), released_by = actor_profile_id, release_reason = 'Account deactivated'
  where profile_id = target_profile_id and released_at is null;

  update public.personnel_unit_assignments
  set ends_at = now(), ended_by = actor_profile_id, end_reason = 'Personnel account deactivated'
  where profile_id = target_profile_id and ends_at is null;

  update public.supervisory_authorities
  set ends_at = now(), ended_by = actor_profile_id,
      reason = concat_ws(E'\n', nullif(reason,''), 'Ended because personnel account was deactivated')
  where ends_at is null and (supervisor_profile_id = target_profile_id or subject_profile_id = target_profile_id);

  update public.personnel_delegations
  set revoked_at = now(), revoked_by = actor_profile_id,
      reason = concat_ws(E'\n', nullif(reason,''), 'Revoked because personnel account was deactivated')
  where profile_id = target_profile_id and revoked_at is null;

  insert into public.training_events(training_progress_id, trainee_profile_id, trainer_profile_id, recorded_by, event_type, phase, status, progress_percent, notes)
  select tp.id, tp.profile_id, tp.evaluator_profile_id, actor_profile_id,
         'Training Withdrawn - Personnel Deactivated', tp.phase, 'Withdrawn', tp.progress_percent,
         'Training closed because the trainee personnel account was deactivated.'
  from public.training_progress tp
  where tp.profile_id = target_profile_id and tp.status in ('Not Started','In Progress','Needs Improvement');

  update public.training_progress
  set status = 'Withdrawn', completed_on = coalesce(completed_on, current_date), updated_at = now()
  where profile_id = target_profile_id and status in ('Not Started','In Progress','Needs Improvement');

  insert into public.training_events(training_progress_id, trainee_profile_id, trainer_profile_id, recorded_by, event_type, phase, status, progress_percent, notes)
  select tp.id, tp.profile_id, tp.evaluator_profile_id, actor_profile_id,
         'Trainer Removed - Personnel Deactivated', tp.phase, tp.status, tp.progress_percent,
         'Assigned trainer was deactivated. A new trainer must be assigned.'
  from public.training_progress tp
  where tp.evaluator_profile_id = target_profile_id and tp.profile_id <> target_profile_id
    and tp.status in ('Not Started','In Progress','Needs Improvement');

  update public.training_progress
  set evaluator_profile_id = null, updated_at = now()
  where evaluator_profile_id = target_profile_id and profile_id <> target_profile_id
    and status in ('Not Started','In Progress','Needs Improvement');

  update public.personnel_profiles
  set status = 'Deactivated', call_sign = null, division = 'Unassigned',
      deactivated_at = now(), deactivated_by = actor_profile_id
  where id = target_profile_id;

  insert into public.personnel_career_events(profile_id, event_type, effective_at, title, notes, recorded_by)
  values (target_profile_id, 'Separation', now(), 'Department separation / account deactivated',
          'Operational assignments and access were closed at deactivation.', actor_profile_id);

  return jsonb_build_object('profile_id', target_profile_id, 'auth_user_id', target.auth_user_id, 'released_call_sign', target.call_sign);
end;
$$;

create or replace function public.executive_reactivate_profile(p_profile_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
  v_actor_rank text;
  v_target public.personnel_profiles;
  v_reason text := nullif(trim(coalesce(p_reason,'')),'');
begin
  select rank into v_actor_rank from public.personnel_profiles where id = v_actor;
  if v_actor is null or v_actor_rank not in ('Sheriff','Undersheriff') then raise exception 'Executive authority required'; end if;
  if v_reason is null or length(v_reason) < 4 then raise exception 'Enter a short Executive reason for reactivation'; end if;
  if p_profile_id = v_actor then raise exception 'You cannot reactivate your own account'; end if;

  select * into v_target from public.personnel_profiles where id = p_profile_id for update;
  if v_target.id is null then raise exception 'Personnel profile not found'; end if;
  if v_target.status <> 'Deactivated' then raise exception 'Personnel profile is not deactivated'; end if;
  if v_target.auth_user_id is null then raise exception 'Assign new credentials before reactivating this account'; end if;

  update public.personnel_profiles
  set status = 'Active', deactivated_at = null, deactivated_by = null, updated_at = now()
  where id = p_profile_id;

  insert into public.personnel_career_events(profile_id, event_type, effective_at, title, notes, recorded_by)
  values (p_profile_id, 'Reinstatement', now(), 'Returned to Active status', v_reason, v_actor);

  insert into public.audit_log(actor_user_id,actor_profile_id,action,table_name,record_id,old_data,new_data)
  values ((select auth.uid()), v_actor, 'ACCOUNT_REACTIVATED', 'personnel_profiles', p_profile_id::text,
          jsonb_build_object('status','Deactivated'), jsonb_build_object('status','Active','reason',v_reason));

  return jsonb_build_object('profile_id',p_profile_id,'status','Active','requires_call_sign',true,'requires_assignment_review',true);
end;
$$;

revoke all on function public.executive_reactivate_profile(uuid,text) from public;
grant execute on function public.executive_reactivate_profile(uuid,text) to authenticated;

create or replace function public.get_login_account_state(p_username text)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select case when exists (
    select 1 from public.personnel_profiles p
    where lower(p.username) = lower(trim(p_username)) and p.status = 'Deactivated'
  ) then 'Deactivated' else 'Other' end;
$$;

revoke all on function public.get_login_account_state(text) from public;
grant execute on function public.get_login_account_state(text) to anon, authenticated;
