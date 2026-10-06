-- Native AEGIS Guardian bridge. These entry points are service-role only and
-- switch to the linked personnel user's claims before invoking the existing
-- Guardian authority model.

create or replace function public.tablet_guardian_purview(p_actor_profile_id uuid)
returns table(
  profile_id uuid,
  personnel_id text,
  display_name text,
  rank text,
  call_sign text,
  status text,
  organizational_unit_id uuid,
  organizational_unit_name text,
  assignment_type text,
  scope text,
  authority_type text
)
language plpgsql
security definer
set search_path='' as $$
declare
  actor_auth uuid;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Server integration required' using errcode='42501';
  end if;
  select auth_user_id into actor_auth from public.personnel_profiles
  where id=p_actor_profile_id and status in ('Active','Acting','Reserve');
  if actor_auth is null then raise exception 'Active personnel account required' using errcode='42501'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',actor_auth)::text,true);
  return query select * from public.get_personnel_in_my_purview();
end $$;
revoke all on function public.tablet_guardian_purview(uuid) from public,anon,authenticated;
grant execute on function public.tablet_guardian_purview(uuid) to service_role;

create or replace function public.tablet_guardian_create(
  p_actor_profile_id uuid,p_subject_profile_id uuid,p_record_type text,p_title text,p_incident_at timestamptz,
  p_location text default null,p_policy_reference text default null,p_observed_behavior text default null,
  p_expected_standard text default null,p_action_taken text default null,p_follow_up_plan text default null,
  p_follow_up_due_at timestamptz default null,p_points integer default 0,p_draft boolean default false
)
returns public.guardian_records language plpgsql security definer set search_path='' as $$
declare actor_auth uuid; actor_tier text; wanted_status text; result public.guardian_records;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Server integration required' using errcode='42501'; end if;
  select auth_user_id,access_tier into actor_auth,actor_tier from public.personnel_profiles
  where id=p_actor_profile_id and status in ('Active','Acting','Reserve');
  if actor_auth is null then raise exception 'Active personnel account required' using errcode='42501'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',actor_auth)::text,true);
  if p_subject_profile_id is null or p_subject_profile_id=p_actor_profile_id or not app_private.current_can_guardian_subject(p_subject_profile_id) then
    raise exception 'This member is outside your supervisory purview' using errcode='42501';
  end if;
  if p_record_type not in ('Feedback','Written Warning','Write-Up','Commendation') then raise exception 'Choose a valid Guardian type'; end if;
  if p_record_type='Commendation' and actor_tier not in ('Executive','Command') then raise exception 'Commendations may only be authored by Command staff' using errcode='42501'; end if;
  if length(trim(coalesce(p_title,'')))<4 or length(trim(coalesce(p_observed_behavior,'')))<10 then raise exception 'Add a title and a complete account of the incident'; end if;
  if p_points is null or p_points<0 or p_points>10 then raise exception 'Points must be between 0 and 10'; end if;
  wanted_status:=case when p_draft then 'Draft' when p_record_type='Write-Up' then 'Pending Approval' else 'Awaiting Acknowledgment' end;
  insert into public.guardian_records(subject_profile_id,record_type,status,title,incident_at,location,policy_reference,observed_behavior,expected_standard,action_taken,follow_up_plan,follow_up_due_at,points_assessed,submitted_at,issued_at,structured_fields)
  values(p_subject_profile_id,p_record_type,wanted_status,trim(p_title),coalesce(p_incident_at,now()),nullif(trim(coalesce(p_location,'')),''),
  nullif(trim(coalesce(p_policy_reference,'')),''),trim(p_observed_behavior),nullif(trim(coalesce(p_expected_standard,'')),''),
  nullif(trim(coalesce(p_action_taken,'')),''),nullif(trim(coalesce(p_follow_up_plan,'')),''),p_follow_up_due_at,
  case when p_record_type='Commendation' then 0 else p_points end,case when wanted_status='Draft' then null else now() end,
  case when wanted_status='Awaiting Acknowledgment' then now() else null end,jsonb_build_object('source','AEGIS Tablet'))
  returning * into result;
  return result;
end $$;
revoke all on function public.tablet_guardian_create(uuid,uuid,text,text,timestamptz,text,text,text,text,text,text,timestamptz,integer,boolean) from public,anon,authenticated;
grant execute on function public.tablet_guardian_create(uuid,uuid,text,text,timestamptz,text,text,text,text,text,text,timestamptz,integer,boolean) to service_role;

create or replace function public.tablet_guardian_review(p_actor_profile_id uuid,p_record_id uuid,p_decision text,p_notes text)
returns public.guardian_records language plpgsql security definer set search_path='' as $$
declare actor_auth uuid; result public.guardian_records;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Server integration required' using errcode='42501'; end if;
  select auth_user_id into actor_auth from public.personnel_profiles where id=p_actor_profile_id and status in ('Active','Acting','Reserve');
  if actor_auth is null then raise exception 'Active personnel account required' using errcode='42501'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',actor_auth)::text,true);
  result:=public.review_guardian(p_record_id,p_decision,p_notes); return result;
end $$;
revoke all on function public.tablet_guardian_review(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.tablet_guardian_review(uuid,uuid,text,text) to service_role;

create or replace function public.tablet_guardian_issue(p_actor_profile_id uuid,p_record_id uuid)
returns public.guardian_records language plpgsql security definer set search_path='' as $$
declare actor_auth uuid; result public.guardian_records;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Server integration required' using errcode='42501'; end if;
  select auth_user_id into actor_auth from public.personnel_profiles where id=p_actor_profile_id and status in ('Active','Acting','Reserve');
  if actor_auth is null then raise exception 'Active personnel account required' using errcode='42501'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',actor_auth)::text,true);
  result:=public.issue_guardian(p_record_id); return result;
end $$;
revoke all on function public.tablet_guardian_issue(uuid,uuid) from public,anon,authenticated;
grant execute on function public.tablet_guardian_issue(uuid,uuid) to service_role;

create or replace function public.tablet_guardian_acknowledge(p_actor_profile_id uuid,p_record_id uuid,p_signature text,p_response text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_auth uuid; result jsonb;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Server integration required' using errcode='42501'; end if;
  select auth_user_id into actor_auth from public.personnel_profiles where id=p_actor_profile_id and status in ('Active','Acting','Reserve');
  if actor_auth is null then raise exception 'Active personnel account required' using errcode='42501'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',actor_auth)::text,true);
  result:=public.acknowledge_guardian(p_record_id,p_signature,p_response); return result;
end $$;
revoke all on function public.tablet_guardian_acknowledge(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.tablet_guardian_acknowledge(uuid,uuid,text,text) to service_role;
