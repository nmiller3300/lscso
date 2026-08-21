-- DESIGN DRAFT ONLY. DO NOT APPLY TO PRODUCTION YET.
-- Requires notification-delivery-v2.sql and the finalized V2 authority resolver.
--
-- Goal: business actions emit ONE department event. Personal portal notifications
-- are recipients of that event. Future Discord embeds deliver the same event once
-- to a configured destination instead of recreating business logic in a bot.

create or replace function app_private.emit_notification_event(
  p_event_key text,
  p_category text,
  p_priority text,
  p_title text,
  p_message text,
  p_href text default null,
  p_action_required boolean default false,
  p_source_type text default null,
  p_source_record_id text default null,
  p_subject_profile_id uuid default null,
  p_actor_profile_id uuid default null,
  p_audience_scope text default 'Direct',
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
begin
  if nullif(btrim(p_event_key), '') is null then raise exception 'Notification event key is required'; end if;
  if p_category not in ('Personnel','Guardians','Requests','Training','Recognition','System') then raise exception 'Unsupported notification category'; end if;
  if p_priority not in ('Critical','High','Normal','Low') then raise exception 'Unsupported notification priority'; end if;
  if p_audience_scope not in ('Direct','Purview','Command','Department','System') then raise exception 'Unsupported notification audience'; end if;

  insert into public.notification_events(
    event_key, category, priority, title, message, href, action_required,
    source_type, source_record_id, subject_profile_id, actor_profile_id,
    audience_scope, metadata
  ) values (
    btrim(p_event_key), p_category, p_priority, p_title, p_message, p_href,
    p_action_required, p_source_type, p_source_record_id, p_subject_profile_id,
    p_actor_profile_id, p_audience_scope, coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (event_key) do nothing
  returning id into event_id;

  if event_id is null then
    select id into event_id from public.notification_events where event_key=btrim(p_event_key);
  end if;

  return event_id;
end;
$$;

create or replace function app_private.notify_event_recipient(
  p_event_id uuid,
  p_recipient_profile_id uuid,
  p_notification_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.notification_events;
  notification_id uuid;
begin
  if p_event_id is null or p_recipient_profile_id is null then return null; end if;
  select * into event_row from public.notification_events where id=p_event_id;
  if event_row.id is null then raise exception 'Notification event not found'; end if;

  insert into public.notifications(
    event_id, recipient_profile_id, notification_type, title, message, href
  ) values (
    event_row.id, p_recipient_profile_id, p_notification_type,
    event_row.title, event_row.message, event_row.href
  )
  on conflict (recipient_profile_id, event_id) where event_id is not null do nothing
  returning id into notification_id;

  return notification_id;
end;
$$;

-- CERTIFICATIONS -------------------------------------------------------------
create or replace function app_private.notify_certification_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
  title text;
  message text;
  priority text := 'Normal';
  event_key text;
  actor uuid;
  action_required boolean := false;
begin
  if tg_op='INSERT' and new.status='Requested' then
    event_key := 'certification:requested:' || new.id::text;
    title := 'Certification requested';
    message := new.name || ' was requested for your personnel record.';
    actor := new.requested_by;
    action_required := true;
  elsif tg_op='INSERT' and new.status='Current' then
    event_key := 'certification:issued:' || new.id::text;
    title := 'Certification issued';
    message := new.name || ' was issued to your personnel record.';
    actor := new.approved_by;
  elsif tg_op='UPDATE' and old.status is distinct from new.status and new.status='Current' then
    event_key := 'certification:issued:' || new.id::text;
    title := 'Certification issued';
    message := new.name || ' was approved and issued.';
    actor := new.approved_by;
  elsif tg_op='UPDATE' and old.status is distinct from new.status and new.status='Revoked' then
    event_key := 'certification:revoked:' || new.id::text;
    priority := 'High';
    actor := new.approved_by;
    if old.status in ('Requested','Pending') then
      title := 'Certification request denied';
      message := new.name || ' was not approved.';
    else
      title := 'Certification revoked';
      message := new.name || ' is no longer current.';
    end if;
  elsif tg_op='UPDATE' and old.status is distinct from new.status and new.status='Expired' then
    event_key := 'certification:expired:' || new.id::text;
    title := 'Certification expired';
    message := new.name || ' has expired.';
  else
    return new;
  end if;

  event_id := app_private.emit_notification_event(
    event_key, 'Training', priority, title, message,
    '/portal/my-office#certifications', action_required,
    'Certification', new.id::text, new.profile_id, actor,
    case when action_required then 'Purview' else 'Direct' end,
    jsonb_build_object('certification_name',new.name,'status',new.status)
  );
  perform app_private.notify_event_recipient(event_id,new.profile_id,'Certification');
  return new;
end;
$$;

-- MEDALS / RECOGNITION -------------------------------------------------------
create or replace function app_private.notify_award_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare event_id uuid;
begin
  event_id := app_private.emit_notification_event(
    'award:issued:' || new.id::text,
    'Recognition','Normal',new.award_name,
    'A departmental decoration was added to your permanent service record.',
    '/portal/my-office#awards',false,'Award',new.id::text,
    new.profile_id,new.awarded_by,'Direct',
    jsonb_build_object('award_name',new.award_name,'awarded_on',new.awarded_on)
  );
  perform app_private.notify_event_recipient(event_id,new.profile_id,'Department Award');
  return new;
end;
$$;

-- DISCIPLINARY POINT / RESTORATION EVENTS ----------------------------------
create or replace function app_private.notify_point_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
  category text;
  priority text;
  title text;
  message text;
begin
  if new.delta > 0 then
    category := 'Guardians';
    priority := 'High';
    title := 'Disciplinary points updated';
    message := '+' || new.delta::text || ' point' || case when new.delta=1 then '' else 's' end || ' added to your current disciplinary score.';
  elsif new.delta < 0 then
    category := 'Recognition';
    priority := 'Normal';
    title := new.event_type;
    message := abs(new.delta)::text || ' disciplinary point' || case when abs(new.delta)=1 then '' else 's' end || ' restored.';
  else
    return new;
  end if;

  event_id := app_private.emit_notification_event(
    'disciplinary-points:' || new.id::text,category,priority,title,message,
    '/portal/my-office#discipline',false,'Disciplinary Point Event',new.id::text,
    new.profile_id,new.authorized_by,'Direct',
    jsonb_build_object('event_type',new.event_type,'delta',new.delta,'reason',new.reason)
  );
  perform app_private.notify_event_recipient(event_id,new.profile_id,'Disciplinary Record');
  return new;
end;
$$;

-- PERSONNEL FLAGS ------------------------------------------------------------
create or replace function app_private.notify_personnel_flag_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
  priority text := 'Normal';
  title text;
  message text;
  actor uuid;
  event_key text;
begin
  if tg_op='INSERT' and new.active then
    event_key := 'personnel-flag:added:' || new.id::text;
    title := 'Personnel flag added';
    message := new.flag_type || ' was added to your personnel record.';
    actor := new.created_by;
    if new.flag_type in ('Restricted Duty','Separation Pending','Command Review Required','Promotion Hold') then priority := 'High'; end if;
  elsif tg_op='UPDATE' and old.active and not new.active then
    event_key := 'personnel-flag:resolved:' || new.id::text;
    title := 'Personnel flag resolved';
    message := new.flag_type || ' is no longer active.';
    actor := new.resolved_by;
  else
    return new;
  end if;

  event_id := app_private.emit_notification_event(
    event_key,'Personnel',priority,title,message,'/portal/my-office#personnel-flags',false,
    'Personnel Flag',new.id::text,new.profile_id,actor,'Direct',
    jsonb_build_object('flag_type',new.flag_type,'active',new.active)
  );
  perform app_private.notify_event_recipient(event_id,new.profile_id,'Personnel Flag');
  return new;
end;
$$;

-- LEGACY DIVISION ASSIGNMENTS (until V2 org assignments replace them) -------
create or replace function app_private.notify_division_assignment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
  event_key text;
  title text;
  message text;
  actor uuid;
begin
  if tg_op='INSERT' then
    event_key := 'division-assignment:added:' || new.id::text;
    title := 'Assignment added';
    message := new.assignment_type || ' assignment: ' || new.division;
    actor := new.assigned_by;
  elsif tg_op='UPDATE' and old.ends_at is null and new.ends_at is not null then
    event_key := 'division-assignment:ended:' || new.id::text;
    title := 'Assignment ended';
    message := new.assignment_type || ' assignment ended: ' || new.division;
    actor := app_private.current_profile_id();
  else
    return new;
  end if;

  event_id := app_private.emit_notification_event(
    event_key,'Personnel','Normal',title,message,'/portal/my-office#assignments',false,
    'Division Assignment',new.id::text,new.profile_id,actor,'Direct',
    jsonb_build_object('division',new.division,'assignment_type',new.assignment_type)
  );
  perform app_private.notify_event_recipient(event_id,new.profile_id,'Assignment');
  return new;
end;
$$;

-- TRAINING / FTO -------------------------------------------------------------
create or replace function app_private.notify_training_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
  event_key text;
  title text;
  message text;
  priority text := 'Normal';
begin
  if tg_op='INSERT' then
    event_key := 'training:assigned:' || new.id::text;
    title := new.program_type || ' training assigned';
    message := new.phase || ' · ' || new.status;
  elsif tg_op='UPDATE' and (old.phase is distinct from new.phase or old.status is distinct from new.status) then
    event_key := 'training:progress:' || new.id::text || ':' || md5(coalesce(new.phase,'') || ':' || coalesce(new.status,''));
    title := new.program_type || ' training updated';
    message := new.phase || ' · ' || new.status;
    if new.status='Needs Improvement' then priority := 'High'; end if;
  else
    return new;
  end if;

  event_id := app_private.emit_notification_event(
    event_key,'Training',priority,title,message,'/portal/my-office#training',false,
    'Training Progress',new.id::text,new.profile_id,new.evaluator_profile_id,'Direct',
    jsonb_build_object('program_type',new.program_type,'phase',new.phase,'status',new.status)
  );
  perform app_private.notify_event_recipient(event_id,new.profile_id,'Training');
  return new;
end;
$$;

-- CALL SIGNS -----------------------------------------------------------------
create or replace function app_private.notify_call_sign_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare event_id uuid;
begin
  if tg_op='INSERT' then
    event_id := app_private.emit_notification_event(
      'call-sign:assigned:' || new.id::text,'Personnel','Normal','Call sign assigned',
      new.call_sign || ' is now assigned to you.','/portal/my-office',false,
      'Call Sign Assignment',new.id::text,new.profile_id,new.assigned_by,'Direct',
      jsonb_build_object('call_sign',new.call_sign)
    );
    perform app_private.notify_event_recipient(event_id,new.profile_id,'Call Sign');
  elsif tg_op='UPDATE' and old.released_at is null and new.released_at is not null then
    event_id := app_private.emit_notification_event(
      'call-sign:released:' || new.id::text,'Personnel','Normal','Call sign released',
      new.call_sign || ' was released from your active assignment.','/portal/my-office',false,
      'Call Sign Assignment',new.id::text,new.profile_id,new.released_by,'Direct',
      jsonb_build_object('call_sign',new.call_sign,'reason',new.release_reason)
    );
    perform app_private.notify_event_recipient(event_id,new.profile_id,'Call Sign');
  end if;
  return new;
end;
$$;

-- RANK / ACCOUNT STATUS ------------------------------------------------------
create or replace function app_private.notify_profile_change_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
  actor uuid := app_private.current_profile_id();
begin
  if old.rank is distinct from new.rank then
    event_id := app_private.emit_notification_event(
      'profile:rank:' || new.id::text || ':' || txid_current()::text,
      'Personnel','Normal','Rank updated',old.rank || ' → ' || new.rank,
      '/portal/my-office',false,'Personnel Profile',new.id::text,new.id,actor,'Direct',
      jsonb_build_object('old_rank',old.rank,'new_rank',new.rank)
    );
    perform app_private.notify_event_recipient(event_id,new.id,'Rank Change');
  end if;

  if old.status is distinct from new.status then
    event_id := app_private.emit_notification_event(
      'profile:status:' || new.id::text || ':' || txid_current()::text,
      'Personnel',case when new.status in ('Suspended','Deactivated') then 'High' else 'Normal' end,
      'Service status updated',old.status || ' → ' || new.status,
      '/portal/my-office',false,'Personnel Profile',new.id::text,new.id,actor,
      case when new.status='Deactivated' then 'Command' else 'Direct' end,
      jsonb_build_object('old_status',old.status,'new_status',new.status)
    );
    -- Keep the direct record even if the account is temporarily unable to sign in;
    -- the event remains available for future Discord/command delivery as well.
    perform app_private.notify_event_recipient(event_id,new.id,'Service Status');
  end if;
  return new;
end;
$$;

-- REQUEST SUBMISSION EVENTS --------------------------------------------------
-- Action Center continues deriving its truth from the source record's current
-- status. These events exist for notification history and future Discord delivery.
create or replace function app_private.notify_personnel_request_submission_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare event_id uuid;
begin
  if new.status not in ('Submitted','In Review') then return new; end if;
  event_id := app_private.emit_notification_event(
    'personnel-request:submitted:' || new.id::text,'Requests','Normal',
    new.request_type || ' request submitted',
    'RQ-' || lpad(new.request_number::text,4,'0') || ' is awaiting review.',
    '/portal/my-office#requests',true,'Personnel Request',new.id::text,
    new.requester_profile_id,new.requester_profile_id,'Purview',
    jsonb_build_object('request_type',new.request_type,'status',new.status)
  );
  perform app_private.notify_event_recipient(event_id,new.requester_profile_id,'Request Submitted');
  return new;
end;
$$;

create or replace function app_private.notify_leave_submission_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare event_id uuid;
begin
  if new.status not in ('Submitted','In Review') then return new; end if;
  event_id := app_private.emit_notification_event(
    'leave-request:submitted:' || new.id::text,'Requests','Normal',
    new.leave_type || ' leave request submitted',
    'LOA-' || lpad(new.request_number::text,4,'0') || ' is awaiting review.',
    '/portal/my-office#requests',true,'Leave Request',new.id::text,
    new.profile_id,new.profile_id,'Purview',
    jsonb_build_object('leave_type',new.leave_type,'status',new.status,'starts_on',new.starts_on)
  );
  perform app_private.notify_event_recipient(event_id,new.profile_id,'Leave Request Submitted');
  return new;
end;
$$;

-- Trigger wiring is intentionally listed here but must not be activated until
-- notification_events exists and the V2 authority routing is ready.
--
-- create trigger certifications_notify_v2 after insert or update of status on public.certifications for each row execute function app_private.notify_certification_event();
-- create trigger personnel_awards_notify_v2 after insert on public.personnel_awards for each row execute function app_private.notify_award_event();
-- create trigger disciplinary_points_notify_v2 after insert on public.disciplinary_point_events for each row execute function app_private.notify_point_event();
-- create trigger personnel_flags_notify_v2 after insert or update of active on public.personnel_flags for each row execute function app_private.notify_personnel_flag_event();
-- create trigger division_assignments_notify_v2 after insert or update of ends_at on public.division_assignments for each row execute function app_private.notify_division_assignment_event();
-- create trigger training_progress_notify_v2 after insert or update of phase,status on public.training_progress for each row execute function app_private.notify_training_event();
-- create trigger call_sign_assignments_notify_v2 after insert or update of released_at on public.call_sign_assignments for each row execute function app_private.notify_call_sign_event();
-- create trigger personnel_profile_changes_notify_v2 after update of rank,status on public.personnel_profiles for each row execute function app_private.notify_profile_change_event();
-- create trigger personnel_requests_submission_notify_v2 after insert on public.personnel_requests for each row execute function app_private.notify_personnel_request_submission_event();
-- create trigger leave_requests_submission_notify_v2 after insert on public.leave_requests for each row execute function app_private.notify_leave_submission_event();
--
-- GUARDIANS: the existing notify_guardian_status trigger must be REPLACED, not
-- layered beside this system. Its current Pending Approval broadcast targets the
-- whole Command access tier and therefore cannot represent V2 1st Lieutenant
-- purview. Guardian event routing is intentionally deferred until the V2
-- database authority resolver is active.
