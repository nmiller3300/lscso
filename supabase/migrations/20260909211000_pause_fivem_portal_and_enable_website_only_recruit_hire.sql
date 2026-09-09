create or replace function app_private.fivem_portal_integration_enabled()
returns boolean
language sql
stable
set search_path = ''
as $$
  select false;
$$;

create or replace function app_private.enqueue_service_personnel_sync_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce((select auth.jwt()->>'role'), '');
  v_citizen_id text;
  v_grade integer;
begin
  if not app_private.fivem_portal_integration_enabled() then return new; end if;
  if v_role <> 'service_role' then return new; end if;
  if new.status = 'Deactivated' then return new; end if;
  if old.rank is not distinct from new.rank and old.status is not distinct from new.status then return new; end if;

  select fil.citizen_id into v_citizen_id
  from public.fivem_identity_links fil
  where fil.personnel_profile_id=new.id and fil.active=true
  order by fil.linked_at desc
  limit 1;

  if v_citizen_id is null then return new; end if;
  v_grade:=app_private.lscso_grade_for_rank(new.rank);
  if v_grade is null then return new; end if;

  insert into public.fivem_personnel_sync_actions(
    personnel_profile_id,citizen_id,desired_rank,desired_grade,desired_status,reason,actor_profile_id
  ) values (
    new.id,v_citizen_id,new.rank,v_grade,new.status,'Personnel account status synchronization',null
  );

  return new;
end;
$$;

create or replace function public.roster_update_personnel_rank_status(p_profile_id uuid, p_rank text, p_status text, p_reason text default null)
returns public.personnel_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid:=app_private.current_profile_id();
  v_actor_rank text;
  v_temp boolean:=app_private.current_has_active_delegation('Temporary Command Authority');
  v_old public.personnel_profiles;
  v_result public.personnel_profiles;
  v_new_tier text;
  v_event_type text;
  v_old_level integer;
  v_new_level integer;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_citizen_id text;
  v_grade integer;
begin
  select rank into v_actor_rank from public.personnel_profiles where id=v_actor;
  if v_actor is null or (v_actor_rank not in ('Sheriff','Undersheriff','Major') and not v_temp) then raise exception 'Personnel change authority required'; end if;
  if v_reason is null or length(v_reason)<4 then raise exception 'Enter a short reason for the personnel change'; end if;
  v_new_tier:=app_private.rank_access_tier(p_rank);
  if v_new_tier is null then raise exception 'Invalid rank'; end if;
  if p_status not in ('Active','Acting','Suspended') then raise exception 'Roster management cannot deactivate accounts; use the protected Command Portal deactivation workflow'; end if;
  select * into v_old from public.personnel_profiles where id=p_profile_id;
  if v_old.id is null then raise exception 'Personnel profile not found'; end if;
  if v_old.status='Deactivated' then raise exception 'Deactivated personnel must be restored through the protected Executive reactivation workflow'; end if;
  if v_old.id=v_actor then raise exception 'Personnel may not change their own rank or status'; end if;
  if v_old.rank='Sheriff' or p_rank='Sheriff' then raise exception 'The Sheriff position cannot be modified through roster management'; end if;
  if v_actor_rank='Major' and (app_private.rank_level(v_old.rank)>=app_private.rank_level('Major') or app_private.rank_level(p_rank)>=app_private.rank_level('Major')) then raise exception 'Major may approve personnel changes below Major rank only'; end if;
  if v_actor_rank not in ('Sheriff','Undersheriff','Major') and (v_old.rank in ('Sheriff','Undersheriff','Major','Captain') or p_rank in ('Sheriff','Undersheriff','Major','Captain')) then raise exception 'Temporary Command Authority may manage 1st Lieutenant and below only'; end if;

  update public.personnel_profiles pp
  set rank=p_rank,access_tier=v_new_tier,status=p_status,updated_at=now()
  where pp.id=p_profile_id
  returning * into v_result;

  if v_old.rank is distinct from p_rank then
    v_old_level:=app_private.rank_level(v_old.rank);
    v_new_level:=app_private.rank_level(p_rank);
    v_event_type:=case when v_new_level>v_old_level then 'Promotion' when v_new_level<v_old_level then 'Demotion' else 'Rank Correction' end;
    insert into public.personnel_career_events(profile_id,event_type,effective_at,from_rank,to_rank,title,notes,recorded_by)
    values(p_profile_id,v_event_type,now(),v_old.rank,p_rank,v_event_type||': '||v_old.rank||' to '||p_rank,v_reason,v_actor);
  end if;

  if v_old.status is distinct from p_status then
    insert into public.personnel_career_events(profile_id,event_type,effective_at,title,notes,recorded_by)
    values(p_profile_id,'Other',now(),'Status: '||v_old.status||' to '||p_status,v_reason,v_actor);
  end if;

  insert into public.audit_log(actor_user_id,actor_profile_id,action,table_name,record_id,old_data,new_data)
  values((select auth.uid()),v_actor,'ROSTER_UPDATE_PERSONNEL','personnel_profiles',p_profile_id::text,
    jsonb_build_object('rank',v_old.rank,'access_tier',v_old.access_tier,'status',v_old.status),
    jsonb_build_object('rank',v_result.rank,'access_tier',v_result.access_tier,'status',v_result.status,'reason',v_reason));

  if app_private.fivem_portal_integration_enabled() and (v_old.rank is distinct from p_rank or v_old.status is distinct from p_status) then
    select fil.citizen_id into v_citizen_id
    from public.fivem_identity_links fil
    where fil.personnel_profile_id=p_profile_id and fil.active=true
    order by fil.linked_at desc
    limit 1;

    if v_citizen_id is not null then
      v_grade:=app_private.lscso_grade_for_rank(p_rank);
      insert into public.fivem_personnel_sync_actions(
        personnel_profile_id,citizen_id,desired_rank,desired_grade,desired_status,reason,actor_profile_id
      ) values (
        p_profile_id,v_citizen_id,p_rank,v_grade,p_status,v_reason,v_actor
      );
    end if;
  end if;

  return v_result;
end
$$;

create or replace function public.executive_reactivate_profile(p_profile_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
  v_actor_rank text;
  v_target public.personnel_profiles;
  v_reason text := nullif(trim(coalesce(p_reason,'')),'');
  v_citizen_id text;
  v_grade integer;
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

  if app_private.fivem_portal_integration_enabled() then
    select fil.citizen_id into v_citizen_id
    from public.fivem_identity_links fil
    where fil.personnel_profile_id=p_profile_id and fil.active=true
    order by fil.linked_at desc
    limit 1;

    if v_citizen_id is not null then
      v_grade:=app_private.lscso_grade_for_rank(v_target.rank);
      insert into public.fivem_personnel_sync_actions(
        personnel_profile_id,citizen_id,desired_rank,desired_grade,desired_status,reason,actor_profile_id
      ) values (
        p_profile_id,v_citizen_id,v_target.rank,v_grade,'Active',v_reason,v_actor
      );
    end if;
  end if;

  return jsonb_build_object('profile_id',p_profile_id,'status','Active','requires_call_sign',true,'requires_assignment_review',true);
end;
$$;

create or replace function public.admin_deactivate_profile(target_profile_id uuid, actor_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.personnel_profiles;
  v_citizen_id text;
  v_grade integer;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'Service role required'; end if;

  select * into target from public.personnel_profiles where id = target_profile_id for update;
  if target.id is null then raise exception 'Personnel profile not found'; end if;
  if target.status = 'Deactivated' then raise exception 'Personnel profile is already deactivated'; end if;

  update public.call_sign_assignments set released_at = now(), released_by = actor_profile_id, release_reason = 'Account deactivated' where profile_id = target_profile_id and released_at is null;
  update public.personnel_unit_assignments set ends_at = now(), ended_by = actor_profile_id, end_reason = 'Personnel account deactivated' where profile_id = target_profile_id and ends_at is null;
  update public.supervisory_authorities set ends_at = now(), ended_by = actor_profile_id, reason = concat_ws(E'\n', nullif(reason,''), 'Ended because personnel account was deactivated') where ends_at is null and (supervisor_profile_id = target_profile_id or subject_profile_id = target_profile_id);
  update public.personnel_delegations set revoked_at = now(), revoked_by = actor_profile_id, reason = concat_ws(E'\n', nullif(reason,''), 'Revoked because personnel account was deactivated') where profile_id = target_profile_id and revoked_at is null;
  update public.certifications set status = 'Revoked', approved_by = actor_profile_id, approved_at = now(), notes = concat_ws(E'\n', nullif(notes,''), 'FTO qualification revoked because personnel account was deactivated.') where profile_id = target_profile_id and name = 'Field Training Officer' and status = 'Current';

  insert into public.training_events(training_progress_id, trainee_profile_id, trainer_profile_id, recorded_by, event_type, phase, status, progress_percent, notes)
  select tp.id, tp.profile_id, tp.evaluator_profile_id, actor_profile_id, 'Training Withdrawn - Personnel Deactivated', tp.phase, 'Withdrawn', tp.progress_percent, 'Training closed because the trainee personnel account was deactivated.'
  from public.training_progress tp where tp.profile_id = target_profile_id and tp.status in ('Not Started','In Progress','Needs Improvement');

  update public.training_progress set status = 'Withdrawn', completed_on = coalesce(completed_on, current_date), updated_at = now() where profile_id = target_profile_id and status in ('Not Started','In Progress','Needs Improvement');

  insert into public.training_events(training_progress_id, trainee_profile_id, trainer_profile_id, recorded_by, event_type, phase, status, progress_percent, notes)
  select tp.id, tp.profile_id, tp.evaluator_profile_id, actor_profile_id, 'Trainer Removed - Personnel Deactivated', tp.phase, tp.status, tp.progress_percent, 'Assigned trainer was deactivated. A new trainer must be assigned.'
  from public.training_progress tp where tp.evaluator_profile_id = target_profile_id and tp.profile_id <> target_profile_id and tp.status in ('Not Started','In Progress','Needs Improvement');

  update public.training_progress set evaluator_profile_id = null, updated_at = now() where evaluator_profile_id = target_profile_id and profile_id <> target_profile_id and status in ('Not Started','In Progress','Needs Improvement');

  update public.personnel_profiles set status = 'Deactivated', call_sign = null, division = 'Unassigned', deactivated_at = now(), deactivated_by = actor_profile_id where id = target_profile_id;

  insert into public.personnel_career_events(profile_id, event_type, effective_at, title, notes, recorded_by)
  values (target_profile_id, 'Separation', now(), 'Department separation / account deactivated', 'Operational assignments, delegated authority, FTO authority, and system access were closed at deactivation.', actor_profile_id);

  if app_private.fivem_portal_integration_enabled() then
    select fil.citizen_id into v_citizen_id
    from public.fivem_identity_links fil
    where fil.personnel_profile_id=target_profile_id and fil.active=true
    order by fil.linked_at desc
    limit 1;

    if v_citizen_id is not null then
      v_grade:=app_private.lscso_grade_for_rank(target.rank);
      insert into public.fivem_personnel_sync_actions(personnel_profile_id,citizen_id,desired_rank,desired_grade,desired_status,reason,actor_profile_id)
      values (target_profile_id,v_citizen_id,target.rank,v_grade,'Deactivated','Personnel account deactivated',actor_profile_id);
    end if;
  end if;

  return jsonb_build_object('profile_id', target_profile_id, 'auth_user_id', target.auth_user_id, 'released_call_sign', target.call_sign);
end;
$$;

alter table public.recruitment_application_history drop constraint if exists recruitment_application_history_event_type_check;
alter table public.recruitment_application_history add constraint recruitment_application_history_event_type_check check (event_type = any (array[
  'Submitted'::text,'Reviewer Assigned'::text,'Status Changed'::text,'Approved for Interview'::text,'Interview Updated'::text,'Note Added'::text,'Accepted'::text,'Denied'::text,'Hired In Game'::text,'Hired In Portal'::text,'Applicant Status Message Updated'::text,'Applicant Status Message Cleared'::text
]));

create or replace function public.record_recruit_hire_website_only(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_profile_id uuid := app_private.current_profile_id();
  v_access_tier text := app_private.current_access_tier();
  v_application public.recruitment_applications%rowtype;
  v_profile public.personnel_profiles%rowtype;
  v_existing_profile uuid;
  v_next_number integer;
  v_personnel_id text;
  v_now timestamptz := now();
begin
  if v_actor_profile_id is null or v_access_tier not in ('Executive','Command') then raise exception 'Only active Command Staff may complete a Recruit appointment.' using errcode = '42501'; end if;

  select * into v_application from public.recruitment_applications where id = p_application_id for update;
  if not found then raise exception 'Application not found.'; end if;
  if v_application.status <> 'Accepted' then raise exception 'Only an accepted application can proceed to Recruit appointment.'; end if;
  if v_application.interview_status <> 'Passed' then raise exception 'The required recruitment interview must be recorded as Passed before hiring.'; end if;

  if v_application.hired_profile_id is not null then
    select * into v_profile from public.personnel_profiles where id = v_application.hired_profile_id;
    return jsonb_build_object('profileId',v_profile.id,'personnelId',v_profile.personnel_id,'rank',v_profile.rank,'alreadyRecorded',true);
  end if;

  if v_application.applicant_auth_user_id is not null then
    select id into v_existing_profile from public.personnel_profiles where auth_user_id = v_application.applicant_auth_user_id limit 1;
    if v_existing_profile is not null then raise exception 'This applicant already has an LSCSO personnel record.'; end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('lscso-personnel-id'));
  select coalesce(max(substring(personnel_id from 4)::integer),0)+1 into v_next_number from public.personnel_profiles where personnel_id ~ '^LS-[0-9]{3}$';
  if v_next_number > 999 then raise exception 'No LSCSO personnel IDs remain available.'; end if;
  v_personnel_id := 'LS-' || lpad(v_next_number::text,3,'0');

  insert into public.personnel_profiles(auth_user_id,personnel_id,display_name,greeting_name,rank,access_tier,call_sign,division,supervisor_label,status,is_test_account)
  values (v_application.applicant_auth_user_id,v_personnel_id,left(v_application.full_name,120),left(v_application.full_name,120),'Recruit','Deputy',null,'Unassigned','Pending command assignment','Active',false)
  returning * into v_profile;

  insert into public.personnel_career_events(profile_id,event_type,effective_at,from_rank,to_rank,title,notes,recorded_by)
  values (v_profile.id,'Appointment',v_now,null,'Recruit','Appointed as LSCSO Recruit','Created from accepted recruitment application ' || v_application.application_number::text || ' after a passed interview. Computer/FiveM integration was not used.',v_actor_profile_id);

  update public.recruitment_applications
  set status='Hired',hired_profile_id=v_profile.id,hired_at=v_now,hired_by_profile_id=v_actor_profile_id,hired_citizen_id=null,hired_license_identifier=null,updated_at=v_now
  where id=p_application_id;

  insert into public.recruitment_application_history(application_id,actor_profile_id,event_type,details)
  values (p_application_id,v_actor_profile_id,'Hired In Portal',jsonb_build_object('application_number',v_application.application_number,'personnel_profile_id',v_profile.id,'personnel_id',v_profile.personnel_id,'rank','Recruit','interview_status',v_application.interview_status,'computer_integration',false));

  return jsonb_build_object('profileId',v_profile.id,'personnelId',v_profile.personnel_id,'rank',v_profile.rank,'alreadyRecorded',false);
end;
$$;

revoke all on function public.record_recruit_hire_website_only(uuid) from public;
revoke all on function public.record_recruit_hire_website_only(uuid) from anon;
grant execute on function public.record_recruit_hire_website_only(uuid) to authenticated;
grant execute on function public.record_recruit_hire_website_only(uuid) to service_role;

revoke execute on function public.record_recruit_hire_from_portal(uuid,text,text,text,integer) from authenticated;
