alter table public.guardian_records drop constraint if exists guardian_records_record_type_check;
alter table public.guardian_records add constraint guardian_records_record_type_check
check (record_type = any (array['Feedback'::text,'Written Warning'::text,'Write-Up'::text,'Commendation'::text,'Performance Evaluation'::text]));

alter table public.guardian_records drop constraint if exists guardian_records_commendation_points;
alter table public.guardian_records add constraint guardian_records_nondisciplinary_points
check ((record_type not in ('Commendation','Performance Evaluation')) or points_assessed = 0);

alter table public.guardian_records add constraint guardian_records_evaluation_no_escalation
check (record_type <> 'Performance Evaluation' or escalation_override = false);

create or replace function public.create_performance_evaluation(
  p_subject_profile_id uuid,
  p_evaluation_kind text,
  p_period_start date,
  p_period_end date,
  p_professional_conduct smallint,
  p_policy_knowledge smallint,
  p_communication smallint,
  p_judgment_decision_making smallint,
  p_report_documentation smallint,
  p_officer_safety_tactics smallint,
  p_initiative_reliability smallint,
  p_teamwork_leadership smallint,
  p_strengths text,
  p_improvement_areas text,
  p_goals text,
  p_supervisor_summary text,
  p_follow_up_due_at timestamptz default null
)
returns public.guardian_records
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.current_profile_id();
  v_tier text := app_private.current_access_tier();
  v_target public.personnel_profiles;
  v_record public.guardian_records;
  v_average numeric(4,2);
  v_label text;
  v_title text;
  v_kind text := trim(coalesce(p_evaluation_kind,''));
  v_strengths text := trim(coalesce(p_strengths,''));
  v_improvement text := trim(coalesce(p_improvement_areas,''));
  v_goals text := trim(coalesce(p_goals,''));
  v_summary text := trim(coalesce(p_supervisor_summary,''));
  v_ratings smallint[];
begin
  if v_actor is null or v_tier not in ('Executive','Command','Supervisor','Preliminary') then
    raise exception 'Supervisor authority required';
  end if;
  if p_subject_profile_id is null or p_subject_profile_id = v_actor then
    raise exception 'Select a personnel member in your supervisory purview';
  end if;
  if not app_private.current_can_guardian_subject(p_subject_profile_id) then
    raise exception 'Guardian authority over this personnel member is required';
  end if;
  select * into v_target from public.personnel_profiles where id=p_subject_profile_id;
  if v_target.id is null then raise exception 'Personnel profile not found'; end if;
  if v_target.status='Deactivated' then raise exception 'Performance evaluations cannot be issued to separated personnel'; end if;
  if v_kind not in ('Routine','Probationary','Annual','Promotion Readiness','Special') then
    raise exception 'Invalid performance evaluation type';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Enter a valid evaluation period';
  end if;
  if p_period_end > current_date then
    raise exception 'The evaluation period cannot end in the future';
  end if;
  v_ratings := array[p_professional_conduct,p_policy_knowledge,p_communication,p_judgment_decision_making,p_report_documentation,p_officer_safety_tactics,p_initiative_reliability,p_teamwork_leadership];
  if exists(select 1 from unnest(v_ratings) rating where rating is null or rating < 1 or rating > 5) then
    raise exception 'Every performance category must be rated from 1 through 5';
  end if;
  if length(v_strengths) < 4 then raise exception 'Document the member''s strengths'; end if;
  if length(v_improvement) < 4 then raise exception 'Document improvement areas or state that none were identified'; end if;
  if length(v_goals) < 4 then raise exception 'Document the next-period goals'; end if;
  if length(v_summary) < 10 then raise exception 'Enter the supervisor''s overall assessment'; end if;
  if greatest(length(v_strengths),length(v_improvement),length(v_goals),length(v_summary)) > 6000 then
    raise exception 'Evaluation narrative fields must be 6000 characters or fewer';
  end if;
  if p_follow_up_due_at is not null and p_follow_up_due_at <= now() then
    raise exception 'Follow-up date must be in the future';
  end if;

  v_average := round((p_professional_conduct+p_policy_knowledge+p_communication+p_judgment_decision_making+p_report_documentation+p_officer_safety_tactics+p_initiative_reliability+p_teamwork_leadership)::numeric/8.0,2);
  v_label := case
    when v_average >= 4.50 then 'Exceptional'
    when v_average >= 3.75 then 'Exceeds Expectations'
    when v_average >= 2.75 then 'Meets Expectations'
    when v_average >= 1.75 then 'Needs Improvement'
    else 'Unsatisfactory'
  end;
  v_title := v_kind || ' Performance Evaluation';

  insert into public.guardian_records(
    subject_profile_id,record_type,status,title,incident_at,location,policy_reference,
    observed_behavior,expected_standard,action_taken,follow_up_plan,follow_up_due_at,
    structured_fields,points_assessed,escalation_override,escalation_reason,
    submitted_at,issued_at
  ) values (
    p_subject_profile_id,'Performance Evaluation','Awaiting Acknowledgment',v_title,now(),
    nullif(trim(coalesce(v_target.division,'')),''),'Performance Evaluation',
    v_summary,v_improvement,v_strengths,v_goals,p_follow_up_due_at,
    jsonb_build_object(
      'evaluation_kind',v_kind,
      'period_start',p_period_start,
      'period_end',p_period_end,
      'ratings',jsonb_build_object(
        'professional_conduct',p_professional_conduct,
        'policy_knowledge',p_policy_knowledge,
        'communication',p_communication,
        'judgment_decision_making',p_judgment_decision_making,
        'report_documentation',p_report_documentation,
        'officer_safety_tactics',p_officer_safety_tactics,
        'initiative_reliability',p_initiative_reliability,
        'teamwork_leadership',p_teamwork_leadership
      ),
      'overall_average',v_average,
      'overall_rating',v_label,
      'strengths',v_strengths,
      'improvement_areas',v_improvement,
      'goals',v_goals,
      'supervisor_summary',v_summary,
      'rating_scale',jsonb_build_object('1','Unsatisfactory','2','Needs Improvement','3','Meets Expectations','4','Exceeds Expectations','5','Exceptional'),
      'allow_response',true,
      'response_window','5 days'
    ),
    0,false,null,now(),now()
  ) returning * into v_record;

  return v_record;
end;
$function$;

revoke all on function public.create_performance_evaluation(uuid,text,date,date,smallint,smallint,smallint,smallint,smallint,smallint,smallint,smallint,text,text,text,text,timestamptz) from public;
grant execute on function public.create_performance_evaluation(uuid,text,date,date,smallint,smallint,smallint,smallint,smallint,smallint,smallint,smallint,text,text,text,text,timestamptz) to authenticated;

create or replace function public.get_guardian_point_total(target_profile_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare total integer;
begin
  if not app_private.current_can_guardian_subject(target_profile_id) then
    raise exception 'Guardian authority over this personnel member is required';
  end if;
  select coalesce(sum(record.points_assessed),0)::integer into total
  from public.guardian_records record
  where record.subject_profile_id=target_profile_id
    and record.record_type in ('Feedback','Written Warning','Write-Up')
    and record.status in ('Approved','Issued','Awaiting Acknowledgment','Acknowledged','Follow-Up Due','Closed');
  return total;
end;
$function$;

create or replace function app_private.sync_guardian_disciplinary_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare qualifies boolean;
begin
  qualifies := new.record_type in ('Feedback','Written Warning','Write-Up')
    and new.points_assessed > 0
    and new.status in ('Approved','Issued','Awaiting Acknowledgment','Acknowledged','Follow-Up Due','Closed');
  if qualifies then
    insert into public.disciplinary_point_events(profile_id,event_type,delta,guardian_id,authorized_by,reason,effective_on)
    values(new.subject_profile_id,'Discipline',new.points_assessed,new.id,coalesce(new.approved_by,new.author_profile_id),'Guardian '||new.record_type,coalesce(new.incident_at::date,new.created_at::date))
    on conflict (guardian_id) where guardian_id is not null
    do update set profile_id=excluded.profile_id,delta=excluded.delta,authorized_by=excluded.authorized_by,reason=excluded.reason,effective_on=excluded.effective_on;
  else
    delete from public.disciplinary_point_events where guardian_id=new.id and event_type='Discipline';
  end if;
  return new;
end;
$function$;

create or replace function public.acknowledge_guardian(record_id uuid, signature_name text, response_text text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_profile public.personnel_profiles;
  guardian public.guardian_records;
  fingerprint text;
  signed_time timestamptz := now();
  requires_typed_name boolean;
  normalized_signature text;
  normalized_display_name text;
  acknowledgment_copy text;
begin
  select * into current_profile from public.personnel_profiles where id=app_private.current_profile_id();
  if current_profile.id is null then raise exception 'Authorized profile required'; end if;
  select * into guardian from public.guardian_records where id=record_id and subject_profile_id=current_profile.id and status in ('Issued','Awaiting Acknowledgment') for update;
  if guardian.id is null then raise exception 'Guardian record is unavailable for acknowledgment'; end if;

  requires_typed_name := guardian.record_type <> 'Commendation';
  normalized_signature := lower(regexp_replace(trim(coalesce(signature_name,'')),'\s+',' ','g'));
  normalized_display_name := lower(regexp_replace(trim(current_profile.display_name),'\s+',' ','g'));
  if requires_typed_name and normalized_signature <> normalized_display_name then
    raise exception 'Type your full personnel name exactly as shown to acknowledge this Guardian';
  end if;

  acknowledgment_copy := case
    when guardian.record_type='Performance Evaluation' then 'I acknowledge receipt of this performance evaluation. My acknowledgment confirms receipt only and does not indicate agreement. This is an internal department acknowledgment and is not a legal signature.'
    when guardian.record_type='Commendation' then 'I acknowledge receipt of this commendation.'
    else 'I acknowledge receipt of this Guardian. My acknowledgment confirms receipt only and does not indicate agreement. This is an internal department acknowledgment and is not a legal signature.'
  end;

  fingerprint := 'GF-'||to_char(signed_time at time zone 'UTC','YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
  insert into public.guardian_acknowledgments(guardian_id,profile_id,fingerprint_id,typed_name,signature_method,acknowledgment_text,personnel_id_snapshot,display_name_snapshot,rank_snapshot,call_sign_snapshot,response_text,signed_at)
  values(guardian.id,current_profile.id,fingerprint,case when requires_typed_name then trim(signature_name) else null end,case when requires_typed_name then 'Typed name' else 'Receipt acknowledgment' end,acknowledgment_copy,current_profile.personnel_id,current_profile.display_name,current_profile.rank,current_profile.call_sign,nullif(trim(response_text),''),signed_time);
  update public.guardian_records set status='Acknowledged',acknowledged_at=signed_time,employee_response=nullif(trim(response_text),''),updated_at=signed_time where id=guardian.id;
  return jsonb_build_object('guardian_id',guardian.id,'guardian_number',guardian.guardian_number,'fingerprint_id',fingerprint,'acknowledged_at',signed_time,'status','Acknowledged');
end;
$function$;

create or replace function app_private.notify_guardian_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op='INSERT' and new.status='Pending Approval' then
    insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
    select profile.id,'Guardian Approval','Guardian awaiting command review','G-'||lpad(new.guardian_number::text,4,'0')||' requires a command decision.','/portal/command/guardians'
    from public.personnel_profiles profile
    where profile.access_tier in ('Executive','Command') and profile.status in ('Active','Acting') and profile.id<>new.author_profile_id;
  end if;

  if (tg_op='INSERT' and new.status in ('Issued','Awaiting Acknowledgment')) or (tg_op='UPDATE' and old.status is distinct from new.status and new.status in ('Issued','Awaiting Acknowledgment')) then
    insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
    values(new.subject_profile_id,'Guardian Issued',case when new.record_type='Performance Evaluation' then 'Performance evaluation ready for acknowledgment' else 'New Guardian ready for acknowledgment' end,case when new.record_type='Performance Evaluation' then 'G-'||lpad(new.guardian_number::text,4,'0')||' performance evaluation has been added to your personnel record.' else 'G-'||lpad(new.guardian_number::text,4,'0')||' has been added to your personnel record.' end,'/portal/personnel#guardians');
  end if;

  if tg_op='UPDATE' and old.status is distinct from new.status and new.status in ('Approved','Denied') then
    insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
    values(new.author_profile_id,'Guardian Review','Guardian '||lower(new.status),'G-'||lpad(new.guardian_number::text,4,'0')||' was '||lower(new.status)||' by command.','/portal/command/guardians');
  end if;

  if tg_op='UPDATE' and old.status is distinct from new.status and new.status='Acknowledged' then
    insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
    values(new.author_profile_id,'Guardian Acknowledged',case when new.record_type='Performance Evaluation' then 'Performance evaluation acknowledged' else 'Guardian acknowledged by member' end,'G-'||lpad(new.guardian_number::text,4,'0')||' has been acknowledged.','/portal/command/guardians');
  end if;
  return new;
end;
$function$;