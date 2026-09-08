alter table public.recruitment_applications
  add column if not exists hired_profile_id uuid references public.personnel_profiles(id) on delete set null,
  add column if not exists hired_at timestamptz,
  add column if not exists hired_by_profile_id uuid references public.personnel_profiles(id) on delete set null,
  add column if not exists hired_citizen_id text,
  add column if not exists hired_license_identifier text;

create unique index if not exists recruitment_applications_hired_profile_unique
  on public.recruitment_applications(hired_profile_id)
  where hired_profile_id is not null;

alter table public.recruitment_application_history
  drop constraint if exists recruitment_application_history_event_type_check;

alter table public.recruitment_application_history
  add constraint recruitment_application_history_event_type_check
  check (event_type in (
    'Submitted','Reviewer Assigned','Status Changed','Interview Updated','Note Added',
    'Accepted','Denied','Hired In Game'
  ));

create or replace function public.record_recruit_hire(
  p_application_id uuid,
  p_actor_profile_id uuid,
  p_target_citizen_id text,
  p_target_license_identifier text default null,
  p_target_name text default null,
  p_target_server_id integer default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_application public.recruitment_applications%rowtype;
  v_profile public.personnel_profiles%rowtype;
  v_existing_link public.fivem_identity_links%rowtype;
  v_existing_profile uuid;
  v_next_number integer;
  v_personnel_id text;
  v_now timestamptz := now();
  v_display_name text;
begin
  if p_application_id is null or p_actor_profile_id is null then
    raise exception 'Application and hiring actor are required.';
  end if;
  if nullif(trim(coalesce(p_target_citizen_id, '')), '') is null then
    raise exception 'FiveM citizen ID is required.';
  end if;

  select * into v_application
  from public.recruitment_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found.';
  end if;
  if v_application.status <> 'Accepted' then
    raise exception 'Only accepted applicants can be hired in-game.';
  end if;

  if v_application.hired_profile_id is not null then
    if v_application.hired_citizen_id = trim(p_target_citizen_id) then
      select * into v_profile from public.personnel_profiles where id = v_application.hired_profile_id;
      return jsonb_build_object(
        'profileId', v_profile.id,
        'personnelId', v_profile.personnel_id,
        'rank', v_profile.rank,
        'alreadyRecorded', true
      );
    end if;
    raise exception 'This application has already been hired to another FiveM identity.';
  end if;

  select * into v_existing_link
  from public.fivem_identity_links
  where citizen_id = trim(p_target_citizen_id)
  limit 1;

  if found then
    raise exception 'This FiveM character is already linked to an LSCSO personnel record.';
  end if;

  if v_application.applicant_auth_user_id is not null then
    select id into v_existing_profile
    from public.personnel_profiles
    where auth_user_id = v_application.applicant_auth_user_id
    limit 1;
    if v_existing_profile is not null then
      raise exception 'This applicant already has an LSCSO personnel record.';
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('lscso-personnel-id'));
  select coalesce(max(substring(personnel_id from 4)::integer), 0) + 1
    into v_next_number
  from public.personnel_profiles
  where personnel_id ~ '^LS-[0-9]{3}$';

  if v_next_number > 999 then
    raise exception 'No LSCSO personnel IDs remain available.';
  end if;

  v_personnel_id := 'LS-' || lpad(v_next_number::text, 3, '0');
  v_display_name := left(coalesce(nullif(trim(p_target_name), ''), v_application.full_name), 120);

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
    v_display_name,
    v_display_name,
    'Recruit',
    'Deputy',
    null,
    'Unassigned',
    'Pending command assignment',
    'Active',
    false
  ) returning * into v_profile;

  insert into public.fivem_identity_links(
    personnel_profile_id,
    citizen_id,
    license_identifier,
    active,
    linked_at,
    linked_by,
    last_seen_at,
    last_seen_grade,
    updated_at
  ) values (
    v_profile.id,
    trim(p_target_citizen_id),
    nullif(trim(coalesce(p_target_license_identifier, '')), ''),
    true,
    v_now,
    p_actor_profile_id,
    v_now,
    0,
    v_now
  );

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
    'Recruit',
    'Appointed as LSCSO Recruit',
    'Created from accepted recruitment application ' || v_application.application_number::text || '.',
    p_actor_profile_id
  );

  update public.recruitment_applications
  set hired_profile_id = v_profile.id,
      hired_at = v_now,
      hired_by_profile_id = p_actor_profile_id,
      hired_citizen_id = trim(p_target_citizen_id),
      hired_license_identifier = nullif(trim(coalesce(p_target_license_identifier, '')), '')
  where id = p_application_id;

  insert into public.recruitment_application_history(
    application_id,
    actor_profile_id,
    event_type,
    details
  ) values (
    p_application_id,
    p_actor_profile_id,
    'Hired In Game',
    jsonb_build_object(
      'application_number', v_application.application_number,
      'target_citizen_id', trim(p_target_citizen_id),
      'target_name', v_display_name,
      'target_server_id', p_target_server_id,
      'job', 'lscso',
      'grade', 0,
      'personnel_profile_id', v_profile.id,
      'personnel_id', v_profile.personnel_id
    )
  );

  return jsonb_build_object(
    'profileId', v_profile.id,
    'personnelId', v_profile.personnel_id,
    'rank', v_profile.rank,
    'alreadyRecorded', false
  );
end;
$$;

revoke execute on function public.record_recruit_hire(uuid,uuid,text,text,text,integer) from public, anon, authenticated;
grant execute on function public.record_recruit_hire(uuid,uuid,text,text,text,integer) to service_role;
