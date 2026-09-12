alter table public.recruitment_applications
  add column if not exists recruitment_closed_at timestamptz,
  add column if not exists recruitment_closed_by_profile_id uuid references public.personnel_profiles(id) on delete set null,
  add column if not exists recruitment_closure_code text,
  add column if not exists recruitment_closure_reason text,
  add column if not exists applicant_tracking_expires_at timestamptz;

alter table public.recruitment_applications
  drop constraint if exists recruitment_applications_closure_reason_length;
alter table public.recruitment_applications
  add constraint recruitment_applications_closure_reason_length
  check (recruitment_closure_reason is null or char_length(recruitment_closure_reason) <= 2000);

create table if not exists public.recruitment_employment_offers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruitment_applications(id) on delete cascade,
  status text not null default 'Pending' check (status in ('Pending','Accepted','Terminated')),
  title text not null default 'Offer of Employment',
  offered_rank text not null default 'Recruit',
  terms text not null,
  issued_by_profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  accepted_at timestamptz,
  accepted_signature_name text,
  accepted_signature_method text,
  terminated_at timestamptz,
  terminated_by_profile_id uuid references public.personnel_profiles(id) on delete set null,
  termination_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recruitment_employment_offers_terms_length check (char_length(btrim(terms)) between 10 and 8000),
  constraint recruitment_employment_offers_signature_length check (accepted_signature_name is null or char_length(btrim(accepted_signature_name)) between 2 and 120),
  constraint recruitment_employment_offers_termination_reason_length check (termination_reason is null or char_length(btrim(termination_reason)) between 4 and 2000)
);

create index if not exists recruitment_employment_offers_application_idx
  on public.recruitment_employment_offers(application_id, issued_at desc);
create unique index if not exists recruitment_employment_offers_one_open_idx
  on public.recruitment_employment_offers(application_id)
  where status in ('Pending','Accepted');

alter table public.recruitment_employment_offers enable row level security;
revoke all on table public.recruitment_employment_offers from public, anon;
grant select on table public.recruitment_employment_offers to authenticated, service_role;
drop policy if exists recruitment_employment_offers_command_read on public.recruitment_employment_offers;
create policy recruitment_employment_offers_command_read
on public.recruitment_employment_offers
for select
to authenticated
using (app_private.current_access_tier() in ('Executive','Command'));

alter table public.recruitment_application_history
  drop constraint if exists recruitment_application_history_event_type_check;
alter table public.recruitment_application_history
  add constraint recruitment_application_history_event_type_check
  check (event_type = any (array[
    'Submitted'::text,
    'Reviewer Assigned'::text,
    'Status Changed'::text,
    'Approved for Interview'::text,
    'Interview Updated'::text,
    'Note Added'::text,
    'Accepted'::text,
    'Denied'::text,
    'Hired In Game'::text,
    'Hired In Portal'::text,
    'Applicant Status Message Updated'::text,
    'Applicant Status Message Cleared'::text,
    'Tracking Link Reissued'::text,
    'Tracking Expiration Updated'::text,
    'Application Closed'::text,
    'Offer Issued'::text,
    'Offer Accepted'::text,
    'Offer Terminated'::text
  ]));

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
  v_terms text;
  v_offer_title text;
  v_offer_rank text;
  v_offer_id uuid;
  v_offer public.recruitment_employment_offers%rowtype;
  v_expires_text text;
  v_expires_at timestamptz;
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
    if v_app.status in ('Accepted', 'Denied', 'Hired', 'Withdrawn', 'Archived') then raise exception 'A finalized application cannot be reassigned.'; end if;
    v_reviewer_text := btrim(coalesce(v_payload ->> 'reviewerProfileId', ''));
    if v_reviewer_text = '' then raise exception 'Select a reviewer.'; end if;
    begin v_reviewer_id := v_reviewer_text::uuid;
    exception when invalid_text_representation then raise exception 'Select a valid reviewer.';
    end;
    select display_name, access_tier, status into v_reviewer_name, v_reviewer_tier, v_reviewer_status
    from public.personnel_profiles where id = v_reviewer_id;
    if v_reviewer_name is null or v_reviewer_tier not in ('Executive','Command') or v_reviewer_status not in ('Active','Acting') then raise exception 'The selected reviewer is unavailable.'; end if;
    if v_app.reviewer_profile_id is not distinct from v_reviewer_id then return jsonb_build_object('success',true,'changed',false); end if;
    update public.recruitment_applications set reviewer_profile_id=v_reviewer_id where id=p_application_id;
    insert into public.recruitment_application_history(application_id,actor_profile_id,event_type,details)
    values(p_application_id,v_actor,'Reviewer Assigned',jsonb_build_object('reviewer_profile_id',v_reviewer_id,'reviewer',v_reviewer_name));

  elsif v_action = 'status' then
    if v_app.status in ('Accepted','Denied','Hired','Withdrawn','Archived') then raise exception 'The application decision has already been recorded.'; end if;
    v_status := btrim(coalesce(v_payload ->> 'status',''));
    if v_status not in ('Submitted','Under Review') then raise exception 'Only Submitted and Under Review are valid screening stages. Use Accept Application or Deny with reason to record the application decision.'; end if;
    if v_app.status = v_status then return jsonb_build_object('success',true,'changed',false); end if;
    update public.recruitment_applications set status=v_status where id=p_application_id;
    insert into public.recruitment_application_history(application_id,actor_profile_id,event_type,details)
    values(p_application_id,v_actor,'Status Changed',jsonb_build_object('from',v_app.status,'to',v_status));

  elsif v_action = 'decision' then
    if v_app.status in ('Accepted','Denied','Hired','Withdrawn','Archived') then raise exception 'This application already has a recorded application decision.'; end if;
    if v_app.status not in ('Submitted','Under Review') then raise exception 'Move the application into the Command review workflow before recording a decision.'; end if;
    v_status := btrim(coalesce(v_payload ->> 'status',''));
    v_reason := btrim(coalesce(v_payload ->> 'reason',''));
    if v_status not in ('Accepted','Denied') then raise exception 'Invalid application decision.'; end if;
    if v_status='Denied' and char_length(v_reason)<4 then raise exception 'A denial reason of at least 4 characters is required.'; end if;
    update public.recruitment_applications
    set status=v_status,decided_at=now(),decided_by_profile_id=v_actor,decision_notes=case when v_status='Denied' then v_reason else null end
    where id=p_application_id;
    insert into public.recruitment_application_history(application_id,actor_profile_id,event_type,details)
    values(p_application_id,v_actor,v_status,case when v_status='Denied' then jsonb_build_object('from',v_app.status,'reason',v_reason) else jsonb_build_object('from',v_app.status,'next_step','Required interview') end);

  elsif v_action = 'note' then
    v_content := btrim(coalesce(v_payload ->> 'content',''));
    if v_content='' then raise exception 'Enter a note before saving.'; end if;
    if char_length(v_content)>8000 then raise exception 'Internal notes cannot exceed 8,000 characters.'; end if;
    insert into public.recruitment_application_notes(application_id,author_profile_id,content) values(p_application_id,v_actor,v_content);
    insert into public.recruitment_application_history(application_id,actor_profile_id,event_type,details)
    values(p_application_id,v_actor,'Note Added',jsonb_build_object('preview',left(v_content,160)));

  elsif v_action = 'interview' then
    if v_app.status <> 'Accepted' then raise exception 'The application must be accepted before an interview can be scheduled or recorded.'; end if;
    if v_app.hired_profile_id is not null then raise exception 'This applicant has already been hired as a Recruit.'; end if;
    if exists(select 1 from public.recruitment_employment_offers o where o.application_id=p_application_id and o.status in ('Pending','Accepted')) then raise exception 'An employment offer has already been issued. Terminate the offer before changing the interview record.'; end if;
    v_interview_status := btrim(coalesce(v_payload ->> 'interviewStatus',''));
    if v_interview_status not in ('Not Scheduled','Scheduled','Completed','No Show','Passed','Failed') then raise exception 'Invalid interview status.'; end if;
    v_interviewer_text := btrim(coalesce(v_payload ->> 'interviewerProfileId',''));
    if v_interviewer_text <> '' then
      begin v_interviewer_id := v_interviewer_text::uuid;
      exception when invalid_text_representation then raise exception 'Select a valid interviewer.';
      end;
      select access_tier,status into v_interviewer_tier,v_interviewer_status from public.personnel_profiles where id=v_interviewer_id;
      if v_interviewer_tier is null or v_interviewer_tier not in ('Executive','Command') or v_interviewer_status not in ('Active','Acting') then raise exception 'The selected interviewer is unavailable.'; end if;
    else v_interviewer_id := null; end if;
    if v_interview_status in ('Passed','Failed') and v_interviewer_id is null then raise exception 'Select the interviewer before recording a Pass or Fail result.'; end if;
    v_scheduled_text := btrim(coalesce(v_payload ->> 'scheduledAt',''));
    if v_scheduled_text <> '' then
      begin v_scheduled_at := v_scheduled_text::timestamptz;
      exception when others then raise exception 'Enter a valid interview date and time.';
      end;
    else v_scheduled_at := null; end if;
    if v_interview_status='Scheduled' and v_scheduled_at is null then raise exception 'Enter the scheduled interview date and time.'; end if;
    v_notes := nullif(btrim(coalesce(v_payload ->> 'notes','')),'');
    v_result := nullif(btrim(coalesce(v_payload ->> 'result','')),'');
    if coalesce(char_length(v_notes),0)>8000 then raise exception 'Interview notes cannot exceed 8,000 characters.'; end if;
    if coalesce(char_length(v_result),0)>8000 then raise exception 'Interview result summaries cannot exceed 8,000 characters.'; end if;
    if v_interview_status in ('Passed','Failed') and coalesce(char_length(v_result),0)<3 then raise exception 'Document the interview result before recording Pass or Fail.'; end if;
    if v_app.interview_status is not distinct from v_interview_status and v_app.interviewer_profile_id is not distinct from v_interviewer_id and v_app.interview_scheduled_at is not distinct from v_scheduled_at and v_app.interview_notes is not distinct from v_notes and v_app.interview_result is not distinct from v_result then return jsonb_build_object('success',true,'changed',false); end if;
    if v_interview_status='No Show' then
      v_reason := 'The selection process was closed because the applicant did not attend the required scheduled interview.';
      update public.recruitment_applications set status='Archived',interview_status=v_interview_status,interviewer_profile_id=v_interviewer_id,interview_scheduled_at=v_scheduled_at,interview_notes=v_notes,interview_result=v_result,recruitment_closed_at=now(),recruitment_closed_by_profile_id=v_actor,recruitment_closure_code='Interview No Show',recruitment_closure_reason=v_reason,updated_at=now() where id=p_application_id;
    else
      update public.recruitment_applications set interview_status=v_interview_status,interviewer_profile_id=v_interviewer_id,interview_scheduled_at=v_scheduled_at,interview_notes=v_notes,interview_result=v_result,updated_at=now() where id=p_application_id;
    end if;
    insert into public.recruitment_application_history(application_id,actor_profile_id,event_type,details) values(p_application_id,v_actor,'Interview Updated',jsonb_build_object('status',v_interview_status,'scheduled_at',v_scheduled_at,'result',v_result));
    if v_interview_status='No Show' then insert into public.recruitment_application_history(application_id,actor_profile_id,event_type,details) values(p_application_id,v_actor,'Application Closed',jsonb_build_object('closure_code','Interview No Show','reason',v_reason)); end if;

  elsif v_action = 'close' then
    if v_app.status='Hired' or v_app.hired_profile_id is not null then raise exception 'A hired application cannot be closed through recruitment.'; end if;
    v_reason := btrim(coalesce(v_payload ->> 'reason',''));
    if char_length(v_reason)<4 then raise exception 'Enter a closure reason of at least 4 characters.'; end if;
    if char_length(v_reason)>2000 then raise exception 'Closure reasons cannot exceed 2,000 characters.'; end if;
    update public.recruitment_employment_offers set status='Terminated',terminated_at=now(),terminated_by_profile_id=v_actor,termination_reason=v_reason,updated_at=now() where application_id=p_application_id and status in ('Pending','Accepted');
    update public.recruitment_applications set status='Archived',recruitment_closed_at=now(),recruitment_closed_by_profile_id=v_actor,recruitment_closure_code='Command Closure',recruitment_closure_reason=v_reason,updated_at=now() where id=p_application_id;
    insert into public.recruitment_application_history(application_id,actor_profile_id,event_type,details) values(p_application_id,v_actor,'Application Closed',jsonb_build_object('reason',v_reason,'closure_code','Command Closure'));

  elsif v_action = 'issue_offer' then
    if v_app.status <> 'Accepted' or v_app.interview_status <> 'Passed' then raise exception 'A passed interview is required before issuing an employment offer.'; end if;
    if v_app.hired_profile_id is not null then raise exception 'This applicant has already been hired as a Recruit.'; end if;
    if exists(select 1 from public.recruitment_employment_offers o where o.application_id=p_application_id and o.status in ('Pending','Accepted')) then raise exception 'This applicant already has an active employment offer.'; end if;
    v_terms := btrim(coalesce(v_payload ->> 'terms',''));
    v_offer_title := coalesce(nullif(btrim(coalesce(v_payload ->> 'title','')),''),'Offer of Employment');
    v_offer_rank := coalesce(nullif(btrim(coalesce(v_payload ->> 'rank','')),''),'Recruit');
    if char_length(v_terms)<10 then raise exception 'Enter the employment offer terms before issuing the offer.'; end if;
    if char_length(v_terms)>8000 then raise exception 'Employment offer terms cannot exceed 8,000 characters.'; end if;
    if char_length(v_offer_title)>160 then raise exception 'Employment offer title cannot exceed 160 characters.'; end if;
    if v_offer_rank <> 'Recruit' then raise exception 'Recruitment employment offers currently support the Recruit rank only.'; end if;
    v_expires_text := btrim(coalesce(v_payload ->> 'expiresAt',''));
    if v_expires_text <> '' then
      begin v_expires_at := v_expires_text::timestamptz;
      exception when others then raise exception 'Enter a valid offer expiration date and time.';
      end;
      if v_expires_at <= now() then raise exception 'Offer expiration must be in the future.'; end if;
    else v_expires_at := null; end if;
    insert into public.recruitment_employment_offers(application_id,status,title,offered_rank,terms,issued_by_profile_id,expires_at)
    values(p_application_id,'Pending',v_offer_title,v_offer_rank,v_terms,v_actor,v_expires_at) returning id into v_offer_id;
    update public.recruitment_applications set updated_at=now() where id=p_application_id;
    insert into public.recruitment_application_history(application_id,actor_profile_id,event_type,details) values(p_application_id,v_actor,'Offer Issued',jsonb_build_object('offer_id',v_offer_id,'rank',v_offer_rank,'expires_at',v_expires_at));

  elsif v_action = 'terminate_offer' then
    begin v_offer_id := (v_payload ->> 'offerId')::uuid;
    exception when others then raise exception 'Select a valid employment offer.';
    end;
    v_reason := btrim(coalesce(v_payload ->> 'reason',''));
    if char_length(v_reason)<4 then raise exception 'Enter a termination reason of at least 4 characters.'; end if;
    if char_length(v_reason)>2000 then raise exception 'Termination reasons cannot exceed 2,000 characters.'; end if;
    if v_app.hired_profile_id is not null or v_app.status='Hired' then raise exception 'An employment offer cannot be terminated after the Recruit appointment is complete.'; end if;
    select * into v_offer from public.recruitment_employment_offers where id=v_offer_id and application_id=p_application_id for update;
    if not found then raise exception 'Employment offer not found.'; end if;
    if v_offer.status not in ('Pending','Accepted') then raise exception 'This employment offer is already closed.'; end if;
    update public.recruitment_employment_offers set status='Terminated',terminated_at=now(),terminated_by_profile_id=v_actor,termination_reason=v_reason,updated_at=now() where id=v_offer_id;
    update public.recruitment_applications set status='Archived',recruitment_closed_at=now(),recruitment_closed_by_profile_id=v_actor,recruitment_closure_code='Offer Terminated',recruitment_closure_reason=v_reason,updated_at=now() where id=p_application_id;
    insert into public.recruitment_application_history(application_id,actor_profile_id,event_type,details) values(p_application_id,v_actor,'Offer Terminated',jsonb_build_object('offer_id',v_offer_id,'reason',v_reason));
    insert into public.recruitment_application_history(application_id,actor_profile_id,event_type,details) values(p_application_id,v_actor,'Application Closed',jsonb_build_object('closure_code','Offer Terminated','reason',v_reason));

  elsif v_action = 'tracking_expiration' then
    v_expires_text := btrim(coalesce(v_payload ->> 'expiresAt',''));
    if v_expires_text <> '' then
      begin v_expires_at := v_expires_text::timestamptz;
      exception when others then raise exception 'Enter a valid tracking link expiration date and time.';
      end;
    else v_expires_at := null; end if;
    update public.recruitment_applications set applicant_tracking_expires_at=v_expires_at,updated_at=now() where id=p_application_id;
    insert into public.recruitment_application_history(application_id,actor_profile_id,event_type,details) values(p_application_id,v_actor,'Tracking Expiration Updated',jsonb_build_object('expires_at',v_expires_at));

  else
    raise exception 'Invalid application action.';
  end if;

  return jsonb_build_object('success',true,'changed',true);
end;
$$;

revoke all on function public.command_recruitment_application_action(uuid,text,jsonb) from public, anon;
grant execute on function public.command_recruitment_application_action(uuid,text,jsonb) to authenticated, service_role;

create or replace function public.accept_recruitment_employment_offer(
  p_tracking_token_hash text,
  p_offer_id uuid,
  p_signature_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.recruitment_applications%rowtype;
  v_offer public.recruitment_employment_offers%rowtype;
  v_signature text := btrim(coalesce(p_signature_name,''));
begin
  if p_tracking_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Tracking link is invalid.'; end if;
  select * into v_app from public.recruitment_applications
  where applicant_tracking_token_hash=p_tracking_token_hash
    and (applicant_tracking_expires_at is null or applicant_tracking_expires_at > now())
  for update;
  if not found then raise exception 'Tracking link is invalid or expired.'; end if;
  if v_app.status <> 'Accepted' or v_app.interview_status <> 'Passed' then raise exception 'This application is not eligible to accept an employment offer.'; end if;
  if v_app.hired_profile_id is not null then raise exception 'The Recruit appointment is already complete.'; end if;
  if lower(v_signature) <> lower(btrim(v_app.full_name)) then raise exception 'Your signature must match the full name on your application.'; end if;
  select * into v_offer from public.recruitment_employment_offers where id=p_offer_id and application_id=v_app.id for update;
  if not found then raise exception 'Employment offer not found.'; end if;
  if v_offer.status='Accepted' then return jsonb_build_object('success',true,'alreadyAccepted',true,'acceptedAt',v_offer.accepted_at); end if;
  if v_offer.status <> 'Pending' then raise exception 'This employment offer is no longer available.'; end if;
  if v_offer.expires_at is not null and v_offer.expires_at <= now() then raise exception 'This employment offer has expired.'; end if;
  update public.recruitment_employment_offers set status='Accepted',accepted_at=now(),accepted_signature_name=v_signature,accepted_signature_method='Private tracking link electronic signature',updated_at=now() where id=p_offer_id;
  update public.recruitment_applications set updated_at=now() where id=v_app.id;
  insert into public.recruitment_application_history(application_id,actor_profile_id,event_type,details)
  values(v_app.id,null,'Offer Accepted',jsonb_build_object('offer_id',p_offer_id,'signed_by',v_signature,'accepted_at',now()));
  return jsonb_build_object('success',true,'alreadyAccepted',false,'acceptedAt',now());
end;
$$;
revoke all on function public.accept_recruitment_employment_offer(text,uuid,text) from public;
grant execute on function public.accept_recruitment_employment_offer(text,uuid,text) to anon, authenticated, service_role;

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
  if v_actor_profile_id is null or v_access_tier not in ('Executive','Command') then raise exception 'Only active Command Staff may complete a Recruit appointment.' using errcode='42501'; end if;
  select * into v_application from public.recruitment_applications where id=p_application_id for update;
  if not found then raise exception 'Application not found.'; end if;
  if v_application.status <> 'Accepted' then raise exception 'Only an accepted application can proceed to Recruit appointment.'; end if;
  if v_application.interview_status <> 'Passed' then raise exception 'The required recruitment interview must be recorded as Passed before hiring.'; end if;
  if not exists(select 1 from public.recruitment_employment_offers o where o.application_id=p_application_id and o.status='Accepted') then raise exception 'The applicant must sign and accept the employment offer before the Recruit appointment can be completed.'; end if;
  if v_application.hired_profile_id is not null then
    select * into v_profile from public.personnel_profiles where id=v_application.hired_profile_id;
    return jsonb_build_object('profileId',v_profile.id,'personnelId',v_profile.personnel_id,'rank',v_profile.rank,'alreadyRecorded',true);
  end if;
  if v_application.applicant_auth_user_id is not null then
    select id into v_existing_profile from public.personnel_profiles where auth_user_id=v_application.applicant_auth_user_id limit 1;
    if v_existing_profile is not null then raise exception 'This applicant already has an LSCSO personnel record.'; end if;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('lscso-personnel-id'));
  select coalesce(max(substring(personnel_id from 4)::integer),0)+1 into v_next_number from public.personnel_profiles where personnel_id ~ '^LS-[0-9]{3}$';
  if v_next_number>999 then raise exception 'No LSCSO personnel IDs remain available.'; end if;
  v_personnel_id := 'LS-' || lpad(v_next_number::text,3,'0');
  insert into public.personnel_profiles(auth_user_id,personnel_id,display_name,greeting_name,rank,access_tier,call_sign,division,supervisor_label,status,is_test_account)
  values(v_application.applicant_auth_user_id,v_personnel_id,left(v_application.full_name,120),left(v_application.full_name,120),'Recruit','Deputy',null,'Unassigned','Pending command assignment','Active',false)
  returning * into v_profile;
  insert into public.personnel_career_events(profile_id,event_type,effective_at,from_rank,to_rank,title,notes,recorded_by)
  values(v_profile.id,'Appointment',v_now,null,'Recruit','Appointed as LSCSO Recruit','Created from accepted recruitment application ' || v_application.application_number::text || ' after a passed interview and signed employment offer. Computer/FiveM integration was not used.',v_actor_profile_id);
  update public.recruitment_applications set status='Hired',hired_profile_id=v_profile.id,hired_at=v_now,hired_by_profile_id=v_actor_profile_id,hired_citizen_id=null,hired_license_identifier=null,updated_at=v_now where id=p_application_id;
  insert into public.recruitment_application_history(application_id,actor_profile_id,event_type,details)
  values(p_application_id,v_actor_profile_id,'Hired In Portal',jsonb_build_object('application_number',v_application.application_number,'personnel_profile_id',v_profile.id,'personnel_id',v_profile.personnel_id,'rank','Recruit','interview_status',v_application.interview_status,'employment_offer_accepted',true,'computer_integration',false));
  return jsonb_build_object('profileId',v_profile.id,'personnelId',v_profile.personnel_id,'rank',v_profile.rank,'alreadyRecorded',false);
end;
$$;
revoke all on function public.record_recruit_hire_website_only(uuid) from public, anon;
grant execute on function public.record_recruit_hire_website_only(uuid) to authenticated, service_role;

drop function if exists public.get_recruitment_application_status(text);
create function public.get_recruitment_application_status(p_tracking_token_hash text)
returns table(
  application_number bigint,
  applicant_name text,
  status text,
  interview_status text,
  submitted_at timestamptz,
  updated_at timestamptz,
  interview_scheduled_at timestamptz,
  applicant_status_message text,
  hired boolean,
  closure_code text,
  closure_reason text,
  offer_id uuid,
  offer_status text,
  offer_title text,
  offer_terms text,
  offer_rank text,
  offer_issued_at timestamptz,
  offer_expires_at timestamptz,
  offer_accepted_at timestamptz,
  offer_signature_name text
)
language sql
security definer
set search_path = ''
as $$
  select
    a.application_number,
    a.full_name,
    a.status,
    a.interview_status,
    a.submitted_at,
    greatest(a.updated_at,coalesce(a.applicant_status_message_updated_at,a.updated_at),coalesce(o.updated_at,a.updated_at)),
    a.interview_scheduled_at,
    a.applicant_status_message,
    (a.status='Hired' or a.hired_profile_id is not null),
    a.recruitment_closure_code,
    a.recruitment_closure_reason,
    o.id,
    case when o.status='Pending' and o.expires_at is not null and o.expires_at <= now() then 'Expired' else o.status end,
    o.title,
    o.terms,
    o.offered_rank,
    o.issued_at,
    o.expires_at,
    o.accepted_at,
    o.accepted_signature_name
  from public.recruitment_applications a
  left join lateral (
    select eo.* from public.recruitment_employment_offers eo
    where eo.application_id=a.id
    order by eo.issued_at desc
    limit 1
  ) o on true
  where p_tracking_token_hash ~ '^[a-f0-9]{64}$'
    and a.applicant_tracking_token_hash=p_tracking_token_hash
    and (a.applicant_tracking_expires_at is null or a.applicant_tracking_expires_at > now())
  limit 1
$$;
revoke all on function public.get_recruitment_application_status(text) from public;
grant execute on function public.get_recruitment_application_status(text) to anon, authenticated, service_role;

create or replace function public.get_recruitment_application_messages(p_tracking_token_hash text)
returns table(id uuid,content text,sent_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select m.id,m.content,m.created_at
  from public.recruitment_applicant_messages m
  join public.recruitment_applications a on a.id=m.application_id
  where p_tracking_token_hash ~ '^[a-f0-9]{64}$'
    and a.applicant_tracking_token_hash=p_tracking_token_hash
    and (a.applicant_tracking_expires_at is null or a.applicant_tracking_expires_at > now())
  order by m.created_at asc
$$;
revoke all on function public.get_recruitment_application_messages(text) from public;
grant execute on function public.get_recruitment_application_messages(text) to anon, authenticated, service_role;

update public.recruitment_applications
set status='Archived',
    recruitment_closed_at=coalesce(recruitment_closed_at,updated_at,now()),
    recruitment_closure_code=coalesce(recruitment_closure_code,'Interview No Show'),
    recruitment_closure_reason=coalesce(recruitment_closure_reason,'The selection process was closed because the applicant did not attend the required scheduled interview.'),
    updated_at=now()
where status='Accepted' and interview_status='No Show' and hired_profile_id is null;
