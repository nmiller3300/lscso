create or replace function public.record_department_attorney_hire_website_only(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor_profile_id uuid:=app_private.current_profile_id();
  v_application public.recruitment_applications%rowtype;
  v_profile public.personnel_profiles%rowtype;
  v_existing_profile uuid;
  v_next_number integer;
  v_personnel_id text;
  v_now timestamptz:=now();
begin
  if v_actor_profile_id is null or not app_private.current_has_hiring_authority() then
    raise exception 'Only active Command Staff may complete a Department Attorney appointment.' using errcode='42501';
  end if;

  select * into v_application
  from public.recruitment_applications
  where id=p_application_id
  for update;

  if not found then
    raise exception 'Application not found.';
  end if;

  if v_application.application_track <> 'Department Attorney' then
    raise exception 'This is not a Department Attorney application.';
  end if;

  if v_application.hired_profile_id is not null then
    select * into v_profile
    from public.personnel_profiles
    where id=v_application.hired_profile_id;

    return jsonb_build_object(
      'profileId',v_profile.id,
      'personnelId',v_profile.personnel_id,
      'rank',v_profile.rank,
      'alreadyRecorded',true
    );
  end if;

  if v_application.status <> 'Accepted' then
    raise exception 'Only an accepted Department Attorney application can proceed to appointment.';
  end if;

  if v_application.interview_status <> 'Passed' then
    raise exception 'The required Department Attorney interview must be recorded as Passed before appointment.';
  end if;

  if v_application.applicant_auth_user_id is not null then
    select id into v_existing_profile
    from public.personnel_profiles
    where auth_user_id=v_application.applicant_auth_user_id
    limit 1;

    if v_existing_profile is not null then
      raise exception 'This applicant already has an LSCSO personnel record.';
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('lscso-personnel-id'));

  select coalesce(max(substring(personnel_id from 4)::integer),0)+1
  into v_next_number
  from public.personnel_profiles
  where personnel_id ~ '^LS-[0-9]{3}$';

  if v_next_number>999 then
    raise exception 'No LSCSO personnel IDs remain available.';
  end if;

  v_personnel_id:='LS-'||lpad(v_next_number::text,3,'0');

  insert into public.personnel_profiles(
    auth_user_id,
    personnel_id,
    display_name,
    greeting_name,
    rank,
    access_tier,
    call_sign,
    division,
    supervisor_label,
    status,
    is_test_account
  ) values (
    v_application.applicant_auth_user_id,
    v_personnel_id,
    left(v_application.full_name,120),
    left(v_application.full_name,120),
    'Department Attorney',
    'Attorney',
    null,
    'Department Attorney',
    'Office of the Sheriff',
    'Active',
    false
  )
  returning * into v_profile;

  -- personnel_profiles_sync_initial_assignment already creates the primary
  -- organizational-unit assignment from the new profile's division. Creating
  -- the same assignment again here violates the one-active-primary constraint
  -- and rolls the entire appointment back.

  insert into public.personnel_career_events(
    profile_id,
    event_type,
    effective_at,
    from_rank,
    to_rank,
    title,
    notes,
    recorded_by
  ) values (
    v_profile.id,
    'Appointment',
    v_now,
    null,
    'Department Attorney',
    'Appointed as LSCSO Department Attorney',
    'Created from accepted Department Attorney application after passed interview. Non-sworn appointment; no operational call sign assigned.',
    v_actor_profile_id
  );

  update public.recruitment_applications
  set status='Hired',
      interview_status='Passed',
      hired_profile_id=v_profile.id,
      hired_at=v_now,
      hired_by_profile_id=v_actor_profile_id,
      hired_citizen_id=null,
      hired_license_identifier=null,
      updated_at=v_now
  where id=p_application_id;

  insert into public.recruitment_application_history(
    application_id,
    actor_profile_id,
    event_type,
    details
  ) values (
    p_application_id,
    v_actor_profile_id,
    'Department Attorney Appointed',
    jsonb_build_object(
      'application_number',v_application.application_number,
      'personnel_profile_id',v_profile.id,
      'personnel_id',v_profile.personnel_id,
      'rank','Department Attorney',
      'access_tier','Attorney',
      'call_sign',null,
      'interview_status','Passed',
      'computer_integration',false
    )
  );

  return jsonb_build_object(
    'profileId',v_profile.id,
    'personnelId',v_profile.personnel_id,
    'rank',v_profile.rank,
    'alreadyRecorded',false
  );
end;
$function$;
