create or replace function public.command_recruitment_application_action(
  p_application_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
  v_tier text := app_private.current_access_tier();
  v_app public.recruitment_applications%rowtype;
  v_action text := btrim(coalesce(p_action, ''));
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_reviewer_text text;
  v_reviewer_id uuid;
  v_reviewer_name text;
  v_reviewer_tier text;
  v_reviewer_status text;
  v_status text;
  v_reason text;
  v_content text;
  v_interview_status text;
  v_interviewer_text text;
  v_interviewer_id uuid;
  v_interviewer_tier text;
  v_interviewer_status text;
  v_scheduled_text text;
  v_scheduled_at timestamptz;
  v_notes text;
  v_result text;
begin
  if v_actor is null or v_tier not in ('Executive', 'Command') then
    raise exception 'You do not have permission to perform this action.' using errcode = '42501';
  end if;

  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'Invalid application action payload.';
  end if;

  select * into v_app
  from public.recruitment_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Unable to load this application.';
  end if;

  if v_action = 'assign_reviewer' then
    if v_app.status in ('Accepted', 'Denied', 'Hired', 'Withdrawn', 'Archived') then
      raise exception 'A finalized application cannot be reassigned.';
    end if;

    v_reviewer_text := btrim(coalesce(v_payload ->> 'reviewerProfileId', ''));
    if v_reviewer_text = '' then raise exception 'Select a reviewer.'; end if;
    begin
      v_reviewer_id := v_reviewer_text::uuid;
    exception when invalid_text_representation then
      raise exception 'Select a valid reviewer.';
    end;

    select display_name, access_tier, status
      into v_reviewer_name, v_reviewer_tier, v_reviewer_status
    from public.personnel_profiles
    where id = v_reviewer_id;

    if v_reviewer_name is null
       or v_reviewer_tier not in ('Executive', 'Command')
       or v_reviewer_status not in ('Active', 'Acting') then
      raise exception 'The selected reviewer is unavailable.';
    end if;

    if v_app.reviewer_profile_id is not distinct from v_reviewer_id then
      return jsonb_build_object('success', true, 'changed', false);
    end if;

    update public.recruitment_applications
    set reviewer_profile_id = v_reviewer_id
    where id = p_application_id;

    insert into public.recruitment_application_history(application_id, actor_profile_id, event_type, details)
    values (p_application_id, v_actor, 'Reviewer Assigned', jsonb_build_object(
      'reviewer_profile_id', v_reviewer_id,
      'reviewer', v_reviewer_name
    ));

  elsif v_action = 'status' then
    if v_app.status in ('Accepted', 'Denied', 'Hired', 'Withdrawn', 'Archived') then
      raise exception 'The application decision has already been recorded.';
    end if;

    v_status := btrim(coalesce(v_payload ->> 'status', ''));
    if v_status not in ('Submitted', 'Under Review') then
      raise exception 'Only Submitted and Under Review are valid screening stages. Use Accept Application or Deny with reason to record the application decision.';
    end if;

    if v_app.status = v_status then
      return jsonb_build_object('success', true, 'changed', false);
    end if;

    update public.recruitment_applications
    set status = v_status
    where id = p_application_id;

    insert into public.recruitment_application_history(application_id, actor_profile_id, event_type, details)
    values (p_application_id, v_actor, 'Status Changed', jsonb_build_object('from', v_app.status, 'to', v_status));

  elsif v_action = 'decision' then
    if v_app.status in ('Accepted', 'Denied', 'Hired', 'Withdrawn', 'Archived') then
      raise exception 'This application already has a recorded application decision.';
    end if;
    if v_app.status not in ('Submitted', 'Under Review') then
      raise exception 'Move the application into the Command review workflow before recording a decision.';
    end if;

    v_status := btrim(coalesce(v_payload ->> 'status', ''));
    v_reason := btrim(coalesce(v_payload ->> 'reason', ''));
    if v_status not in ('Accepted', 'Denied') then raise exception 'Invalid application decision.'; end if;
    if v_status = 'Denied' and char_length(v_reason) < 4 then
      raise exception 'A denial reason of at least 4 characters is required.';
    end if;

    update public.recruitment_applications
    set status = v_status,
        decided_at = now(),
        decided_by_profile_id = v_actor,
        decision_notes = case when v_status = 'Denied' then v_reason else null end
    where id = p_application_id;

    insert into public.recruitment_application_history(application_id, actor_profile_id, event_type, details)
    values (
      p_application_id,
      v_actor,
      v_status,
      case when v_status = 'Denied'
        then jsonb_build_object('from', v_app.status, 'reason', v_reason)
        else jsonb_build_object('from', v_app.status, 'next_step', 'Required interview')
      end
    );

  elsif v_action = 'note' then
    v_content := btrim(coalesce(v_payload ->> 'content', ''));
    if v_content = '' then raise exception 'Enter a note before saving.'; end if;
    if char_length(v_content) > 8000 then raise exception 'Internal notes cannot exceed 8,000 characters.'; end if;

    insert into public.recruitment_application_notes(application_id, author_profile_id, content)
    values (p_application_id, v_actor, v_content);

    insert into public.recruitment_application_history(application_id, actor_profile_id, event_type, details)
    values (p_application_id, v_actor, 'Note Added', jsonb_build_object('preview', left(v_content, 160)));

  elsif v_action = 'interview' then
    if v_app.status <> 'Accepted' then
      raise exception 'The application must be accepted before an interview can be scheduled or recorded.';
    end if;
    if v_app.hired_profile_id is not null then
      raise exception 'This applicant has already been hired as a Recruit.';
    end if;

    v_interview_status := btrim(coalesce(v_payload ->> 'interviewStatus', ''));
    if v_interview_status not in ('Not Scheduled', 'Scheduled', 'Completed', 'No Show', 'Passed', 'Failed') then
      raise exception 'Invalid interview status.';
    end if;

    v_interviewer_text := btrim(coalesce(v_payload ->> 'interviewerProfileId', ''));
    if v_interviewer_text <> '' then
      begin
        v_interviewer_id := v_interviewer_text::uuid;
      exception when invalid_text_representation then
        raise exception 'Select a valid interviewer.';
      end;

      select access_tier, status
        into v_interviewer_tier, v_interviewer_status
      from public.personnel_profiles
      where id = v_interviewer_id;

      if v_interviewer_tier is null
         or v_interviewer_tier not in ('Executive', 'Command')
         or v_interviewer_status not in ('Active', 'Acting') then
        raise exception 'The selected interviewer is unavailable.';
      end if;
    else
      v_interviewer_id := null;
    end if;

    if v_interview_status in ('Passed', 'Failed') and v_interviewer_id is null then
      raise exception 'Select the interviewer before recording a Pass or Fail result.';
    end if;

    v_scheduled_text := btrim(coalesce(v_payload ->> 'scheduledAt', ''));
    if v_scheduled_text <> '' then
      begin
        v_scheduled_at := v_scheduled_text::timestamptz;
      exception when others then
        raise exception 'Enter a valid interview date and time.';
      end;
    else
      v_scheduled_at := null;
    end if;

    if v_interview_status = 'Scheduled' and v_scheduled_at is null then
      raise exception 'Enter the scheduled interview date and time.';
    end if;

    v_notes := nullif(btrim(coalesce(v_payload ->> 'notes', '')), '');
    v_result := nullif(btrim(coalesce(v_payload ->> 'result', '')), '');
    if coalesce(char_length(v_notes), 0) > 8000 then raise exception 'Interview notes cannot exceed 8,000 characters.'; end if;
    if coalesce(char_length(v_result), 0) > 8000 then raise exception 'Interview result summaries cannot exceed 8,000 characters.'; end if;
    if v_interview_status in ('Passed', 'Failed') and coalesce(char_length(v_result), 0) < 3 then
      raise exception 'Document the interview result before recording Pass or Fail.';
    end if;

    if v_app.interview_status is not distinct from v_interview_status
       and v_app.interviewer_profile_id is not distinct from v_interviewer_id
       and v_app.interview_scheduled_at is not distinct from v_scheduled_at
       and v_app.interview_notes is not distinct from v_notes
       and v_app.interview_result is not distinct from v_result then
      return jsonb_build_object('success', true, 'changed', false);
    end if;

    update public.recruitment_applications
    set interview_status = v_interview_status,
        interviewer_profile_id = v_interviewer_id,
        interview_scheduled_at = v_scheduled_at,
        interview_notes = v_notes,
        interview_result = v_result
    where id = p_application_id;

    insert into public.recruitment_application_history(application_id, actor_profile_id, event_type, details)
    values (p_application_id, v_actor, 'Interview Updated', jsonb_build_object(
      'status', v_interview_status,
      'scheduled_at', v_scheduled_at,
      'result', v_result
    ));

  else
    raise exception 'Invalid application action.';
  end if;

  return jsonb_build_object('success', true, 'changed', true);
end;
$$;

revoke all on function public.command_recruitment_application_action(uuid,text,jsonb) from public, anon;
grant execute on function public.command_recruitment_application_action(uuid,text,jsonb) to authenticated, service_role;
