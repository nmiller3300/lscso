alter table public.recruitment_applications
  add column if not exists applicant_tracking_token_hash text,
  add column if not exists applicant_tracking_issued_at timestamptz,
  add column if not exists applicant_status_message text,
  add column if not exists applicant_status_message_updated_at timestamptz,
  add column if not exists applicant_status_message_updated_by_profile_id uuid references public.personnel_profiles(id);

alter table public.recruitment_applications
  drop constraint if exists recruitment_applications_tracking_hash_format,
  add constraint recruitment_applications_tracking_hash_format
    check (applicant_tracking_token_hash is null or applicant_tracking_token_hash ~ '^[a-f0-9]{64}$'),
  drop constraint if exists recruitment_applications_applicant_status_message_length,
  add constraint recruitment_applications_applicant_status_message_length
    check (applicant_status_message is null or char_length(applicant_status_message) <= 2000);

create unique index if not exists recruitment_applications_tracking_hash_unique
  on public.recruitment_applications(applicant_tracking_token_hash)
  where applicant_tracking_token_hash is not null;

create index if not exists recruitment_applications_applicant_status_updated_by_idx
  on public.recruitment_applications(applicant_status_message_updated_by_profile_id)
  where applicant_status_message_updated_by_profile_id is not null;

create or replace function public.submit_recruitment_application(
  p_answers jsonb,
  p_signature_name text,
  p_certification_text text,
  p_tracking_token_hash text
)
returns table(id uuid, application_number bigint, applicant_signed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  q record;
  v_answer text;
  v_normalized_answers jsonb := '{}'::jsonb;
  v_snapshot jsonb;
  v_question_count integer := 0;
  v_full_name text;
  v_discord_username text;
  v_age integer;
  v_timezone text;
  v_signature_name text := trim(coalesce(p_signature_name, ''));
  v_certification_text text := trim(coalesce(p_certification_text, ''));
  v_tracking_hash text := lower(trim(coalesce(p_tracking_token_hash, '')));
  v_existing_number bigint;
  v_application public.recruitment_applications%rowtype;
begin
  if not exists (
    select 1
    from public.recruitment_settings s
    where s.id = 'applications'
      and s.applications_open = true
  ) then
    raise exception 'LSCSO applications are currently closed. New submissions are not being accepted.';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Please submit a valid application answer set.';
  end if;

  if v_tracking_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Applicant tracking token is invalid.';
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', q0.id::text,
          'questionKey', q0.question_key,
          'sectionTitle', q0.section_title,
          'sectionShortTitle', q0.section_short_title,
          'sectionEyebrow', q0.section_eyebrow,
          'sectionDescription', q0.section_description,
          'prompt', q0.prompt,
          'questionType', q0.question_type,
          'helpText', q0.help_text,
          'placeholder', q0.placeholder,
          'options', coalesce(q0.options, '[]'::jsonb),
          'required', q0.required,
          'active', q0.active,
          'sortOrder', q0.sort_order,
          'systemField', q0.system_field,
          'locked', q0.locked
        )
        order by q0.sort_order, q0.created_at
      ),
      '[]'::jsonb
    ),
    count(*)::integer
  into v_snapshot, v_question_count
  from public.recruitment_application_questions q0
  where q0.active = true;

  if v_question_count = 0 then
    raise exception 'The application form is not currently configured.';
  end if;

  for q in
    select *
    from public.recruitment_application_questions
    where active = true
    order by sort_order, created_at
  loop
    v_answer := trim(coalesce(p_answers ->> q.question_key, ''));

    if q.required and v_answer = '' then
      raise exception 'Please answer every required application question.';
    end if;

    if char_length(v_answer) > 8000 then
      raise exception 'Application answers cannot exceed 8,000 characters.';
    end if;

    if q.question_type = 'multiple_choice'
       and v_answer <> ''
       and not coalesce(q.options, '[]'::jsonb) ? v_answer then
      raise exception 'Select a valid answer for: %', q.prompt;
    end if;

    if q.question_type = 'yes_no'
       and v_answer <> ''
       and v_answer not in ('Yes', 'No') then
      raise exception 'Select Yes or No for: %', q.prompt;
    end if;

    if v_answer <> '' then
      v_normalized_answers := v_normalized_answers || jsonb_build_object(q.question_key, v_answer);
    end if;
  end loop;

  v_full_name := trim(coalesce(v_normalized_answers ->> 'full_name', ''));
  v_discord_username := trim(coalesce(v_normalized_answers ->> 'discord_username', ''));
  v_timezone := nullif(trim(coalesce(v_normalized_answers ->> 'timezone', '')), '');

  if char_length(v_full_name) < 2 or char_length(v_full_name) > 120 then
    raise exception 'Please enter a valid full name.';
  end if;

  if char_length(v_discord_username) < 2 or char_length(v_discord_username) > 100 then
    raise exception 'Please enter a valid Discord username.';
  end if;

  if nullif(trim(coalesce(v_normalized_answers ->> 'age', '')), '') is not null then
    begin
      if (v_normalized_answers ->> 'age') !~ '^\d+$' then
        raise exception 'invalid_age';
      end if;
      v_age := (v_normalized_answers ->> 'age')::integer;
    exception
      when others then
        raise exception 'Please enter a valid age between 13 and 100.';
    end;

    if v_age < 13 or v_age > 100 then
      raise exception 'Please enter a valid age between 13 and 100.';
    end if;
  end if;

  if v_timezone is not null and (char_length(v_timezone) < 2 or char_length(v_timezone) > 80) then
    raise exception 'Please enter a valid timezone.';
  end if;

  if char_length(v_signature_name) < 2
     or char_length(v_signature_name) > 120
     or lower(v_signature_name) <> lower(v_full_name) then
    raise exception 'Your electronic signature must match the full name on your application.';
  end if;

  if char_length(v_certification_text) < 10 or char_length(v_certification_text) > 4000 then
    raise exception 'Applicant certification is invalid.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('recruitment-application:' || lower(v_discord_username))
  );

  select a.application_number
  into v_existing_number
  from public.recruitment_applications a
  where lower(a.discord_username) = lower(v_discord_username)
    and a.created_at >= now() - interval '24 hours'
    and a.status not in ('Withdrawn', 'Archived')
  order by a.created_at desc
  limit 1;

  if v_existing_number is not null then
    raise exception 'An application for this Discord account was already submitted in the last 24 hours (APP-%). Please wait for Command review instead of submitting a duplicate.',
      lpad(v_existing_number::text, 4, '0');
  end if;

  insert into public.recruitment_applications (
    full_name,
    discord_username,
    age,
    timezone,
    fivem_experience,
    previous_departments,
    weekly_hours,
    upcoming_commitments,
    why_lscso,
    contribution,
    drug_use_history,
    serious_roleplay_definition,
    reasonable_suspicion_probable_cause,
    use_of_force_factors,
    scenario_speeding_nervous,
    scenario_deputy_policy_violation,
    scenario_supervisor_order,
    mandatory_training,
    prior_discipline,
    policy_agreement,
    status,
    applicant_certification,
    applicant_signature_name,
    applicant_signed_at,
    applicant_signature_method,
    applicant_certification_text,
    applicant_auth_user_id,
    application_answers,
    application_question_snapshot,
    applicant_tracking_token_hash,
    applicant_tracking_issued_at
  ) values (
    v_full_name,
    v_discord_username,
    v_age,
    v_timezone,
    nullif(v_normalized_answers ->> 'fivem_experience', ''),
    nullif(v_normalized_answers ->> 'previous_departments', ''),
    nullif(v_normalized_answers ->> 'weekly_hours', ''),
    nullif(v_normalized_answers ->> 'upcoming_commitments', ''),
    nullif(v_normalized_answers ->> 'why_lscso', ''),
    nullif(v_normalized_answers ->> 'contribution', ''),
    nullif(v_normalized_answers ->> 'drug_use_history', ''),
    nullif(v_normalized_answers ->> 'serious_roleplay_definition', ''),
    nullif(v_normalized_answers ->> 'reasonable_suspicion_probable_cause', ''),
    nullif(v_normalized_answers ->> 'use_of_force_factors', ''),
    nullif(v_normalized_answers ->> 'scenario_speeding_nervous', ''),
    nullif(v_normalized_answers ->> 'scenario_deputy_policy_violation', ''),
    nullif(v_normalized_answers ->> 'scenario_supervisor_order', ''),
    null,
    null,
    null,
    'Submitted',
    true,
    v_signature_name,
    now(),
    'Click to sign',
    v_certification_text,
    auth.uid(),
    v_normalized_answers,
    v_snapshot,
    v_tracking_hash,
    now()
  )
  returning * into v_application;

  return query
  select v_application.id, v_application.application_number, v_application.applicant_signed_at;
end;
$$;

revoke all on function public.submit_recruitment_application(jsonb, text, text, text) from public;
grant execute on function public.submit_recruitment_application(jsonb, text, text, text) to anon, authenticated, service_role;

create or replace function public.get_recruitment_application_status(p_tracking_token_hash text)
returns table(
  application_number bigint,
  applicant_name text,
  status text,
  interview_status text,
  submitted_at timestamptz,
  updated_at timestamptz,
  interview_scheduled_at timestamptz,
  applicant_status_message text,
  hired boolean
)
language sql
security definer
set search_path = ''
as $$
  select
    a.application_number,
    a.full_name as applicant_name,
    a.status,
    a.interview_status,
    a.submitted_at,
    greatest(a.updated_at, coalesce(a.applicant_status_message_updated_at, a.updated_at)) as updated_at,
    a.interview_scheduled_at,
    a.applicant_status_message,
    (a.status = 'Hired' or a.hired_profile_id is not null) as hired
  from public.recruitment_applications a
  where p_tracking_token_hash ~ '^[a-f0-9]{64}$'
    and a.applicant_tracking_token_hash = p_tracking_token_hash
  limit 1
$$;

revoke all on function public.get_recruitment_application_status(text) from public;
grant execute on function public.get_recruitment_application_status(text) to anon, authenticated, service_role;
