create or replace function app_private.enforce_recruitment_offer_minimum_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.expires_at is not null and new.expires_at < now() + interval '24 hours' then
    raise exception 'Employment offers must remain valid for at least 24 hours.';
  end if;
  return new;
end;
$$;

drop trigger if exists recruitment_offer_minimum_window on public.recruitment_employment_offers;
create trigger recruitment_offer_minimum_window
before insert or update of expires_at on public.recruitment_employment_offers
for each row execute function app_private.enforce_recruitment_offer_minimum_window();

create or replace function public.command_recruitment_extend_offer(
  p_application_id uuid,
  p_offer_id uuid,
  p_hours integer default 72
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
  v_app public.recruitment_applications%rowtype;
  v_offer public.recruitment_employment_offers%rowtype;
  v_expires_at timestamptz;
begin
  if v_actor is null or not app_private.current_has_hiring_authority() then
    raise exception 'You do not have permission to extend an employment offer.' using errcode='42501';
  end if;
  if p_hours < 24 or p_hours > 168 then
    raise exception 'Offer extensions must be between 24 hours and 7 days.';
  end if;
  select * into v_app from public.recruitment_applications where id=p_application_id for update;
  if not found then raise exception 'Unable to load this application.'; end if;
  if v_app.status <> 'Accepted' or v_app.interview_status <> 'Passed' then raise exception 'This application is not eligible for an employment offer.'; end if;
  if v_app.hired_profile_id is not null then raise exception 'This applicant has already been appointed.'; end if;
  select * into v_offer from public.recruitment_employment_offers where id=p_offer_id and application_id=p_application_id for update;
  if not found then raise exception 'Employment offer not found.'; end if;
  if v_offer.status <> 'Pending' then raise exception 'Only a pending employment offer can be extended.'; end if;
  v_expires_at := now() + make_interval(hours => p_hours);
  update public.recruitment_employment_offers set expires_at=v_expires_at, updated_at=now() where id=p_offer_id;
  update public.recruitment_applications set updated_at=now() where id=p_application_id;
  insert into public.recruitment_application_history(application_id,actor_profile_id,event_type,details)
  values(p_application_id,v_actor,'Offer Issued',jsonb_build_object('offer_id',p_offer_id,'rank',v_offer.offered_rank,'expires_at',v_expires_at,'extension_hours',p_hours,'extended',true));
  return jsonb_build_object('success',true,'changed',true,'expiresAt',v_expires_at);
end;
$$;

revoke all on function public.command_recruitment_extend_offer(uuid,uuid,integer) from public, anon;
grant execute on function public.command_recruitment_extend_offer(uuid,uuid,integer) to authenticated, service_role;

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
  v_offer_rank text;
  v_offer_access_tier text;
  v_fivem_grade integer;
begin
  if p_application_id is null or p_actor_profile_id is null then raise exception 'Application and hiring actor are required.'; end if;
  if nullif(trim(coalesce(p_target_citizen_id, '')), '') is null then raise exception 'FiveM citizen ID is required.'; end if;
  select * into v_application from public.recruitment_applications where id=p_application_id for update;
  if not found then raise exception 'Application not found.'; end if;
  if v_application.status <> 'Accepted' then raise exception 'Only an accepted application can proceed to appointment.'; end if;
  if v_application.interview_status <> 'Passed' then raise exception 'The required recruitment interview must be recorded as Passed before hiring.'; end if;
  if v_application.hired_profile_id is not null then
    if v_application.hired_citizen_id = trim(p_target_citizen_id) then
      select * into v_profile from public.personnel_profiles where id=v_application.hired_profile_id;
      return jsonb_build_object('profileId',v_profile.id,'personnelId',v_profile.personnel_id,'rank',v_profile.rank,'alreadyRecorded',true);
    end if;
    raise exception 'This application has already been hired to another FiveM identity.';
  end if;
  select o.offered_rank into v_offer_rank
  from public.recruitment_employment_offers o
  where o.application_id=p_application_id and o.status='Accepted'
  order by o.accepted_at desc nulls last, o.issued_at desc limit 1;
  if v_offer_rank is null then raise exception 'The applicant must sign and accept the employment offer before the appointment can be completed.'; end if;
  v_offer_access_tier := app_private.rank_access_tier(v_offer_rank);
  v_fivem_grade := app_private.lscso_grade_for_rank(v_offer_rank);
  if v_offer_access_tier is null or v_fivem_grade is null then raise exception 'The accepted employment offer contains an invalid LSCSO rank.'; end if;
  select * into v_existing_link from public.fivem_identity_links where citizen_id=trim(p_target_citizen_id) limit 1;
  if found then raise exception 'This FiveM character is already linked to an LSCSO personnel record.'; end if;
  if v_application.applicant_auth_user_id is not null then
    select id into v_existing_profile from public.personnel_profiles where auth_user_id=v_application.applicant_auth_user_id limit 1;
    if v_existing_profile is not null then raise exception 'This applicant already has an LSCSO personnel record.'; end if;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('lscso-personnel-id'));
  select coalesce(max(substring(personnel_id from 4)::integer),0)+1 into v_next_number from public.personnel_profiles where personnel_id ~ '^LS-[0-9]{3}$';
  if v_next_number > 999 then raise exception 'No LSCSO personnel IDs remain available.'; end if;
  v_personnel_id := 'LS-' || lpad(v_next_number::text,3,'0');
  v_display_name := left(coalesce(nullif(trim(p_target_name),''),v_application.full_name),120);
  insert into public.personnel_profiles(auth_user_id,personnel_id,display_name,greeting_name,rank,access_tier,call_sign,division,supervisor_label,status,is_test_account)
  values(v_application.applicant_auth_user_id,v_personnel_id,v_display_name,v_display_name,v_offer_rank,v_offer_access_tier,null,'Unassigned','Pending command assignment','Active',false)
  returning * into v_profile;
  insert into public.fivem_identity_links(personnel_profile_id,citizen_id,license_identifier,active,linked_at,linked_by,last_seen_at,last_seen_grade,updated_at)
  values(v_profile.id,trim(p_target_citizen_id),nullif(trim(coalesce(p_target_license_identifier,'')),''),true,v_now,p_actor_profile_id,v_now,v_fivem_grade,v_now);
  insert into public.personnel_career_events(profile_id,event_type,effective_at,from_rank,to_rank,title,notes,recorded_by)
  values(v_profile.id,'Appointment',v_now,null,v_offer_rank,'Appointed as LSCSO ' || v_offer_rank,'Created from accepted recruitment application ' || v_application.application_number::text || ' after a passed interview and signed employment offer.',p_actor_profile_id);
  update public.recruitment_applications set hired_profile_id=v_profile.id,hired_at=v_now,hired_by_profile_id=p_actor_profile_id,hired_citizen_id=trim(p_target_citizen_id),hired_license_identifier=nullif(trim(coalesce(p_target_license_identifier,'')),'') where id=p_application_id;
  insert into public.recruitment_application_history(application_id,actor_profile_id,event_type,details)
  values(p_application_id,p_actor_profile_id,'Hired In Game',jsonb_build_object('application_number',v_application.application_number,'target_citizen_id',trim(p_target_citizen_id),'target_name',v_display_name,'target_server_id',p_target_server_id,'job','lscso','grade',v_fivem_grade,'rank',v_offer_rank,'personnel_profile_id',v_profile.id,'personnel_id',v_profile.personnel_id,'interview_status',v_application.interview_status,'employment_offer_accepted',true));
  return jsonb_build_object('profileId',v_profile.id,'personnelId',v_profile.personnel_id,'rank',v_profile.rank,'grade',v_fivem_grade,'alreadyRecorded',false);
end;
$$;

revoke all on function public.record_recruit_hire(uuid,uuid,text,text,text,integer) from public, anon, authenticated;
grant execute on function public.record_recruit_hire(uuid,uuid,text,text,text,integer) to service_role;
