create sequence if not exists public.rehire_reinstatement_case_number_seq start 1;

create table if not exists public.rehire_reinstatement_cases (
  id uuid primary key default gen_random_uuid(),
  case_number bigint not null unique default nextval('public.rehire_reinstatement_case_number_seq'),
  subject_profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  case_type text not null check (case_type in ('Rehire','Reinstatement')),
  status text not null default 'Under Review' check (status in ('Under Review','Interview Required','Approved','Denied','Completed')),
  initiated_by_profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  former_rank text not null,
  proposed_rank text not null,
  statement text not null check (char_length(btrim(statement)) between 10 and 4000),
  interview_requirement text not null check (interview_requirement in ('Required','Waived - Prior Interview','Not Required')),
  linked_application_id uuid references public.recruitment_applications(id) on delete set null,
  interview_status text not null default 'Not Required' check (interview_status in ('Not Required','Not Scheduled','Scheduled','Passed','Failed','No Show')),
  interview_scheduled_at timestamptz,
  interviewer_profile_id uuid references public.personnel_profiles(id) on delete set null,
  interview_notes text,
  academy_disposition text not null check (academy_disposition in ('Required','Completed','Not Required','Waived')),
  fto_disposition text not null check (fto_disposition in ('Required','Completed','Not Required','Waived')),
  decision_notes text,
  decided_by_profile_id uuid references public.personnel_profiles(id) on delete set null,
  decided_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists rehire_reinstatement_one_open_case_per_member
on public.rehire_reinstatement_cases(subject_profile_id)
where status in ('Under Review','Interview Required','Approved');

create table if not exists public.rehire_reinstatement_events (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.rehire_reinstatement_cases(id) on delete cascade,
  event_type text not null,
  actor_profile_id uuid references public.personnel_profiles(id) on delete set null,
  actor_label text,
  detail text,
  from_status text,
  to_status text,
  created_at timestamptz not null default now()
);

create index if not exists rehire_reinstatement_events_case_idx on public.rehire_reinstatement_events(case_id,created_at desc);

alter table public.rehire_reinstatement_cases enable row level security;
alter table public.rehire_reinstatement_events enable row level security;
revoke all on public.rehire_reinstatement_cases from public,anon,authenticated;
revoke all on public.rehire_reinstatement_events from public,anon,authenticated;
revoke all on sequence public.rehire_reinstatement_case_number_seq from public,anon,authenticated;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='rehire_reinstatement_cases_updated_at') then
    create trigger rehire_reinstatement_cases_updated_at before update on public.rehire_reinstatement_cases
    for each row execute function app_private.set_updated_at();
  end if;
end $$;

create or replace function app_private.current_is_rehire_executive()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.personnel_profiles p where p.id=app_private.current_profile_id() and p.status in ('Active','Acting') and p.rank in ('Sheriff','Undersheriff')) $$;
revoke all on function app_private.current_is_rehire_executive() from public,anon,authenticated;

create or replace function app_private.rehire_actor_label(p_profile_id uuid)
returns text language sql stable security definer set search_path=''
as $$ select trim(concat_ws(' ',p.rank,p.display_name)) from public.personnel_profiles p where p.id=p_profile_id $$;
revoke all on function app_private.rehire_actor_label(uuid) from public,anon,authenticated;

create or replace function public.get_rehire_reinstatement_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_actor uuid:=app_private.current_profile_id(); v_result jsonb;
begin
  if v_actor is null or not app_private.current_is_rehire_executive() then raise exception 'Sheriff or Undersheriff authority required' using errcode='42501'; end if;
  select jsonb_build_object(
    'candidates',coalesce((select jsonb_agg(jsonb_build_object(
      'profileId',p.id,'personnelId',p.personnel_id,'displayName',p.display_name,'formerRank',p.rank,'deactivatedAt',p.deactivated_at,
      'credentialsLinked',(p.auth_user_id is not null),'lastCallSign',last_call.call_sign,'lastAssignment',last_assignment.name,
      'separationTitle',separation.title,'separationNotes',separation.notes,
      'guardianCount',(select count(*) from public.guardian_records g where g.subject_profile_id=p.id),
      'trainingCount',(select count(*) from public.personnel_training_records tr where tr.profile_id=p.id),
      'certificationCount',(select count(*) from public.certifications c where c.profile_id=p.id),
      'awardCount',(select count(*) from public.personnel_awards a where a.profile_id=p.id),
      'priorApplications',coalesce((select jsonb_agg(jsonb_build_object(
        'id',ra.id,'applicationNumber',ra.application_number,'status',ra.status,'interviewStatus',ra.interview_status,
        'interviewScheduledAt',ra.interview_scheduled_at,'interviewResult',ra.interview_result,'submittedAt',ra.submitted_at,
        'matchBasis',case when ra.hired_profile_id=p.id then 'Personnel record' when p.auth_user_id is not null and ra.applicant_auth_user_id=p.auth_user_id then 'Account match' else 'Name match' end
      ) order by ra.submitted_at desc) from public.recruitment_applications ra where ra.hired_profile_id=p.id or (p.auth_user_id is not null and ra.applicant_auth_user_id=p.auth_user_id) or lower(btrim(ra.full_name))=lower(btrim(p.display_name))),'[]'::jsonb)
    ) order by p.deactivated_at desc nulls last,p.display_name)
    from public.personnel_profiles p
    left join lateral (select csa.call_sign from public.call_sign_assignments csa where csa.profile_id=p.id order by coalesce(csa.released_at,csa.assigned_at) desc limit 1) last_call on true
    left join lateral (select ou.name from public.personnel_unit_assignments pua join public.organizational_units ou on ou.id=pua.organizational_unit_id where pua.profile_id=p.id order by coalesce(pua.ends_at,pua.starts_at) desc limit 1) last_assignment on true
    left join lateral (select ce.title,ce.notes from public.personnel_career_events ce where ce.profile_id=p.id and ce.event_type='Separation' order by ce.effective_at desc limit 1) separation on true
    where p.status='Deactivated' and not p.is_test_account),'[]'::jsonb),
    'cases',coalesce((select jsonb_agg(jsonb_build_object(
      'id',rc.id,'caseNumber',rc.case_number,'subjectProfileId',rc.subject_profile_id,'personnelId',p.personnel_id,'displayName',p.display_name,
      'caseType',rc.case_type,'status',rc.status,'formerRank',rc.former_rank,'proposedRank',rc.proposed_rank,'statement',rc.statement,
      'interviewRequirement',rc.interview_requirement,'linkedApplicationId',rc.linked_application_id,'interviewStatus',rc.interview_status,
      'interviewScheduledAt',rc.interview_scheduled_at,'interviewerProfileId',rc.interviewer_profile_id,'interviewNotes',rc.interview_notes,
      'academyDisposition',rc.academy_disposition,'ftoDisposition',rc.fto_disposition,'decisionNotes',rc.decision_notes,
      'credentialsLinked',(p.auth_user_id is not null),'createdAt',rc.created_at,'decidedAt',rc.decided_at,'completedAt',rc.completed_at,
      'events',coalesce((select jsonb_agg(jsonb_build_object('eventType',e.event_type,'actorLabel',e.actor_label,'detail',e.detail,'fromStatus',e.from_status,'toStatus',e.to_status,'createdAt',e.created_at) order by e.created_at desc) from public.rehire_reinstatement_events e where e.case_id=rc.id),'[]'::jsonb)
    ) order by rc.created_at desc) from public.rehire_reinstatement_cases rc join public.personnel_profiles p on p.id=rc.subject_profile_id where rc.created_at>=now()-interval '2 years' or rc.status in ('Under Review','Interview Required','Approved')),'[]'::jsonb),
    'reviewers',coalesce((select jsonb_agg(jsonb_build_object('profileId',p.id,'displayName',p.display_name,'rank',p.rank) order by app_private.rank_level(p.rank) desc,p.display_name) from public.personnel_profiles p where p.status in ('Active','Acting') and p.access_tier in ('Executive','Command','Supervisor')),'[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;
revoke all on function public.get_rehire_reinstatement_workspace() from public,anon;
grant execute on function public.get_rehire_reinstatement_workspace() to authenticated;

create or replace function public.open_rehire_reinstatement_case(p_subject_profile_id uuid,p_case_type text,p_proposed_rank text,p_interview_requirement text,p_linked_application_id uuid,p_statement text,p_academy_disposition text,p_fto_disposition text)
returns public.rehire_reinstatement_cases language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=app_private.current_profile_id(); v_actor_rank text; v_subject public.personnel_profiles; v_case public.rehire_reinstatement_cases; v_app public.recruitment_applications; v_label text;
begin
  if v_actor is null or not app_private.current_is_rehire_executive() then raise exception 'Sheriff or Undersheriff authority required' using errcode='42501'; end if;
  select rank into v_actor_rank from public.personnel_profiles where id=v_actor;
  if p_subject_profile_id=v_actor then raise exception 'You cannot open a return review for your own personnel record'; end if;
  if p_case_type not in ('Rehire','Reinstatement') then raise exception 'Return type must be Rehire or Reinstatement'; end if;
  if p_interview_requirement not in ('Required','Waived - Prior Interview','Not Required') then raise exception 'Invalid interview requirement'; end if;
  if p_academy_disposition not in ('Required','Completed','Not Required','Waived') or p_fto_disposition not in ('Required','Completed','Not Required','Waived') then raise exception 'Invalid Academy or FTO disposition'; end if;
  if coalesce(length(btrim(p_statement)),0)<10 then raise exception 'Enter the reason for opening this return review'; end if;
  select * into v_subject from public.personnel_profiles where id=p_subject_profile_id for update;
  if v_subject.id is null then raise exception 'Personnel record not found'; end if;
  if v_subject.status<>'Deactivated' then raise exception 'Only separated personnel may enter rehire or reinstatement review'; end if;
  if app_private.rank_level(p_proposed_rank) is null or p_proposed_rank='Sheriff' then raise exception 'Invalid return rank'; end if;
  if app_private.rank_level(p_proposed_rank)>app_private.rank_level(v_subject.rank) then raise exception 'A returning member may not be returned above their former rank; use Promotion Review after return'; end if;
  if app_private.rank_level(p_proposed_rank)>=app_private.rank_level(v_actor_rank) then raise exception 'You may only approve return to a rank below your own'; end if;
  if exists(select 1 from public.rehire_reinstatement_cases c where c.subject_profile_id=p_subject_profile_id and c.status in ('Under Review','Interview Required','Approved')) then raise exception 'An active return review already exists for this member'; end if;
  if p_linked_application_id is not null then
    select * into v_app from public.recruitment_applications where id=p_linked_application_id;
    if v_app.id is null then raise exception 'Linked recruitment application not found'; end if;
    if not (v_app.hired_profile_id=v_subject.id or (v_subject.auth_user_id is not null and v_app.applicant_auth_user_id=v_subject.auth_user_id) or lower(btrim(v_app.full_name))=lower(btrim(v_subject.display_name))) then raise exception 'The selected recruitment application does not match this personnel record'; end if;
  end if;
  if p_interview_requirement='Waived - Prior Interview' and (p_linked_application_id is null or v_app.interview_status<>'Passed') then raise exception 'A passed prior interview must be linked before waiving a new interview'; end if;
  v_label:=app_private.rehire_actor_label(v_actor);
  insert into public.rehire_reinstatement_cases(subject_profile_id,case_type,status,initiated_by_profile_id,former_rank,proposed_rank,statement,interview_requirement,linked_application_id,interview_status,academy_disposition,fto_disposition)
  values(p_subject_profile_id,p_case_type,case when p_interview_requirement='Required' then 'Interview Required' else 'Under Review' end,v_actor,v_subject.rank,p_proposed_rank,btrim(p_statement),p_interview_requirement,p_linked_application_id,case when p_interview_requirement='Required' then 'Not Scheduled' else 'Not Required' end,p_academy_disposition,p_fto_disposition) returning * into v_case;
  insert into public.rehire_reinstatement_events(case_id,event_type,actor_profile_id,actor_label,detail,to_status) values(v_case.id,'Return Review Opened',v_actor,v_label,btrim(p_statement),v_case.status);
  insert into public.audit_log(actor_user_id,actor_profile_id,action,table_name,record_id,new_data) values((select auth.uid()),v_actor,'RETURN_REVIEW_OPENED','rehire_reinstatement_cases',v_case.id::text,jsonb_build_object('subject_profile_id',p_subject_profile_id,'case_type',p_case_type,'proposed_rank',p_proposed_rank,'interview_requirement',p_interview_requirement));
  return v_case;
end; $$;
revoke all on function public.open_rehire_reinstatement_case(uuid,text,text,text,uuid,text,text,text) from public,anon;
grant execute on function public.open_rehire_reinstatement_case(uuid,text,text,text,uuid,text,text,text) to authenticated;

create or replace function public.schedule_rehire_reinstatement_interview(p_case_id uuid,p_scheduled_at timestamptz,p_interviewer_profile_id uuid)
returns public.rehire_reinstatement_cases language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=app_private.current_profile_id(); v_case public.rehire_reinstatement_cases; v_interviewer public.personnel_profiles; v_label text;
begin
  if v_actor is null or not app_private.current_is_rehire_executive() then raise exception 'Sheriff or Undersheriff authority required' using errcode='42501'; end if;
  select * into v_case from public.rehire_reinstatement_cases where id=p_case_id and status='Interview Required' for update;
  if v_case.id is null then raise exception 'This return review is not awaiting an interview'; end if;
  if p_scheduled_at is null or p_scheduled_at<=now() then raise exception 'Interview time must be in the future'; end if;
  select * into v_interviewer from public.personnel_profiles where id=p_interviewer_profile_id and status in ('Active','Acting') and access_tier in ('Executive','Command','Supervisor');
  if v_interviewer.id is null then raise exception 'Select an active supervisor or Command interviewer'; end if;
  v_label:=app_private.rehire_actor_label(v_actor);
  update public.rehire_reinstatement_cases set interview_scheduled_at=p_scheduled_at,interviewer_profile_id=p_interviewer_profile_id,interview_status='Scheduled' where id=p_case_id returning * into v_case;
  insert into public.rehire_reinstatement_events(case_id,event_type,actor_profile_id,actor_label,detail,from_status,to_status) values(p_case_id,'Return Interview Scheduled',v_actor,v_label,'Interview scheduled for '||to_char(p_scheduled_at at time zone 'UTC','YYYY-MM-DD HH24:MI')||' UTC','Interview Required','Interview Required');
  return v_case;
end; $$;
revoke all on function public.schedule_rehire_reinstatement_interview(uuid,timestamptz,uuid) from public,anon;
grant execute on function public.schedule_rehire_reinstatement_interview(uuid,timestamptz,uuid) to authenticated;

create or replace function public.record_rehire_reinstatement_interview(p_case_id uuid,p_result text,p_notes text)
returns public.rehire_reinstatement_cases language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=app_private.current_profile_id(); v_case public.rehire_reinstatement_cases; v_label text; v_from text;
begin
  if v_actor is null then raise exception 'Authenticated personnel account required'; end if;
  select * into v_case from public.rehire_reinstatement_cases where id=p_case_id and status='Interview Required' and interview_status='Scheduled' for update;
  if v_case.id is null then raise exception 'This return interview is not available for a result'; end if;
  if not app_private.current_is_rehire_executive() and v_case.interviewer_profile_id<>v_actor then raise exception 'Only the assigned interviewer or Executive Command may record this interview'; end if;
  if p_result not in ('Passed','Failed','No Show') then raise exception 'Interview result must be Passed, Failed, or No Show'; end if;
  if coalesce(length(btrim(p_notes)),0)<4 then raise exception 'Record a short interview result note'; end if;
  v_label:=app_private.rehire_actor_label(v_actor); v_from:=v_case.status;
  update public.rehire_reinstatement_cases set interview_status=p_result,interview_notes=btrim(p_notes),status=case when p_result='Passed' then 'Under Review' else 'Denied' end,
    decision_notes=case when p_result='Failed' then 'Return interview failed: '||btrim(p_notes) when p_result='No Show' then 'Return review closed for failure to appear: '||btrim(p_notes) else decision_notes end,
    decided_by_profile_id=case when p_result in ('Failed','No Show') then v_actor else decided_by_profile_id end,
    decided_at=case when p_result in ('Failed','No Show') then now() else decided_at end where id=p_case_id returning * into v_case;
  insert into public.rehire_reinstatement_events(case_id,event_type,actor_profile_id,actor_label,detail,from_status,to_status)
  values(p_case_id,case when p_result='Passed' then 'Return Interview Passed' when p_result='Failed' then 'Return Interview Failed' else 'Return Interview No Show' end,v_actor,v_label,btrim(p_notes),v_from,v_case.status);
  return v_case;
end; $$;
revoke all on function public.record_rehire_reinstatement_interview(uuid,text,text) from public,anon;
grant execute on function public.record_rehire_reinstatement_interview(uuid,text,text) to authenticated;

create or replace function public.decide_rehire_reinstatement_case(p_case_id uuid,p_decision text,p_notes text)
returns public.rehire_reinstatement_cases language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=app_private.current_profile_id(); v_case public.rehire_reinstatement_cases; v_label text; v_from text;
begin
  if v_actor is null or not app_private.current_is_rehire_executive() then raise exception 'Sheriff or Undersheriff authority required' using errcode='42501'; end if;
  if p_decision not in ('Approved','Denied') then raise exception 'Decision must be Approved or Denied'; end if;
  if coalesce(length(btrim(p_notes)),0)<4 then raise exception 'Record a short decision reason'; end if;
  select * into v_case from public.rehire_reinstatement_cases where id=p_case_id and status='Under Review' for update;
  if v_case.id is null then raise exception 'This return review is not ready for decision'; end if;
  if v_case.subject_profile_id=v_actor then raise exception 'You cannot decide your own return review'; end if;
  if v_case.interview_requirement='Required' and v_case.interview_status<>'Passed' then raise exception 'The required return interview must be passed before approval'; end if;
  v_label:=app_private.rehire_actor_label(v_actor); v_from:=v_case.status;
  update public.rehire_reinstatement_cases set status=p_decision,decision_notes=btrim(p_notes),decided_by_profile_id=v_actor,decided_at=now() where id=p_case_id returning * into v_case;
  insert into public.rehire_reinstatement_events(case_id,event_type,actor_profile_id,actor_label,detail,from_status,to_status) values(p_case_id,case when p_decision='Approved' then 'Return Approved' else 'Return Denied' end,v_actor,v_label,btrim(p_notes),v_from,p_decision);
  return v_case;
end; $$;
revoke all on function public.decide_rehire_reinstatement_case(uuid,text,text) from public,anon;
grant execute on function public.decide_rehire_reinstatement_case(uuid,text,text) to authenticated;

create or replace function public.complete_rehire_reinstatement_case(p_case_id uuid,p_notes text default null)
returns public.rehire_reinstatement_cases language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=app_private.current_profile_id(); v_actor_rank text; v_case public.rehire_reinstatement_cases; v_subject public.personnel_profiles; v_label text; v_new_tier text; v_reason text;
begin
  if v_actor is null or not app_private.current_is_rehire_executive() then raise exception 'Sheriff or Undersheriff authority required' using errcode='42501'; end if;
  select rank into v_actor_rank from public.personnel_profiles where id=v_actor;
  select * into v_case from public.rehire_reinstatement_cases where id=p_case_id and status='Approved' for update;
  if v_case.id is null then raise exception 'This return review is not approved for completion'; end if;
  if v_case.subject_profile_id=v_actor then raise exception 'You cannot complete your own return'; end if;
  select * into v_subject from public.personnel_profiles where id=v_case.subject_profile_id for update;
  if v_subject.status<>'Deactivated' then raise exception 'Personnel record is no longer separated'; end if;
  if v_subject.auth_user_id is null then raise exception 'Assign or restore personnel account credentials before completing the return'; end if;
  if app_private.rank_level(v_case.proposed_rank)>=app_private.rank_level(v_actor_rank) then raise exception 'You may only complete return to a rank below your own'; end if;
  v_new_tier:=app_private.rank_access_tier(v_case.proposed_rank); if v_new_tier is null then raise exception 'Invalid return rank'; end if;
  v_reason:=v_case.case_type||' review RR-'||lpad(v_case.case_number::text,4,'0')||': '||coalesce(nullif(btrim(p_notes),''),v_case.decision_notes,v_case.statement);
  update public.personnel_profiles set rank=v_case.proposed_rank,access_tier=v_new_tier,status='Active',call_sign=null,division='Unassigned',supervisor_label='Pending command assignment',deactivated_at=null,deactivated_by=null,updated_at=now() where id=v_subject.id;
  insert into public.personnel_career_events(profile_id,event_type,effective_at,from_rank,to_rank,title,notes,recorded_by)
  values(v_subject.id,'Reinstatement',now(),v_case.former_rank,v_case.proposed_rank,case when v_case.case_type='Rehire' then 'Rehired to active service' else 'Reinstated to active service' end,v_reason,v_actor);
  insert into public.training_requirement_dispositions(profile_id,requirement,disposition,reason,effective_at,authorized_by)
  values(v_subject.id,'Academy',v_case.academy_disposition,'Return review RR-'||lpad(v_case.case_number::text,4,'0')||': '||v_case.case_type||' entry basis.',now(),v_actor),
        (v_subject.id,'FTO',v_case.fto_disposition,'Return review RR-'||lpad(v_case.case_number::text,4,'0')||': '||v_case.case_type||' entry basis.',now(),v_actor);
  update public.rehire_reinstatement_cases set status='Completed',completed_at=now() where id=p_case_id returning * into v_case;
  v_label:=app_private.rehire_actor_label(v_actor);
  insert into public.rehire_reinstatement_events(case_id,event_type,actor_profile_id,actor_label,detail,from_status,to_status) values(p_case_id,case when v_case.case_type='Rehire' then 'Rehire Completed' else 'Reinstatement Completed' end,v_actor,v_label,v_reason,'Approved','Completed');
  insert into public.audit_log(actor_user_id,actor_profile_id,action,table_name,record_id,old_data,new_data) values((select auth.uid()),v_actor,'RETURN_COMPLETED','personnel_profiles',v_subject.id::text,jsonb_build_object('status','Deactivated','rank',v_subject.rank),jsonb_build_object('status','Active','rank',v_case.proposed_rank,'return_case_id',v_case.id,'reason',v_reason));
  return v_case;
end; $$;
revoke all on function public.complete_rehire_reinstatement_case(uuid,text) from public,anon;
grant execute on function public.complete_rehire_reinstatement_case(uuid,text) to authenticated;
