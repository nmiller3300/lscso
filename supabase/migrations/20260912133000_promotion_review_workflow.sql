create sequence if not exists public.promotion_case_number_seq start with 1 increment by 1;

create table if not exists public.promotion_cases (
  id uuid primary key default gen_random_uuid(),
  case_number bigint not null default nextval('public.promotion_case_number_seq'),
  subject_profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  source_type text not null check (source_type in ('Self Request','Supervisor Recommendation','Command Initiated')),
  initiated_by_profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  current_rank text not null,
  requested_rank text not null,
  statement text not null,
  status text not null default 'Submitted' check (status in ('Submitted','Under Review','Approved','Denied','Withdrawn')),
  decision_notes text,
  decided_by_profile_id uuid references public.personnel_profiles(id) on delete set null,
  decided_at timestamptz,
  effective_at timestamptz,
  is_test_record boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotion_cases_rank_change check (current_rank <> requested_rank)
);

create unique index if not exists promotion_cases_open_subject_idx
  on public.promotion_cases(subject_profile_id)
  where status in ('Submitted','Under Review');
create index if not exists promotion_cases_status_created_idx on public.promotion_cases(status, created_at desc);
create index if not exists promotion_cases_subject_created_idx on public.promotion_cases(subject_profile_id, created_at desc);

create table if not exists public.promotion_case_events (
  id uuid primary key default gen_random_uuid(),
  promotion_case_id uuid not null references public.promotion_cases(id) on delete cascade,
  event_type text not null,
  actor_profile_id uuid references public.personnel_profiles(id) on delete set null,
  actor_label text,
  detail text,
  from_status text,
  to_status text,
  created_at timestamptz not null default now()
);
create index if not exists promotion_case_events_case_created_idx on public.promotion_case_events(promotion_case_id, created_at);

alter table public.promotion_cases enable row level security;
alter table public.promotion_case_events enable row level security;
revoke all on public.promotion_cases from anon, authenticated;
revoke all on public.promotion_case_events from anon, authenticated;
grant select on public.promotion_cases to authenticated;
grant select on public.promotion_case_events to authenticated;

drop policy if exists promotion_cases_select on public.promotion_cases;
create policy promotion_cases_select on public.promotion_cases
for select to authenticated
using (
  subject_profile_id = app_private.current_profile_id()
  or initiated_by_profile_id = app_private.current_profile_id()
  or app_private.current_is_roster_leadership()
  or exists (
    select 1 from public.get_personnel_in_my_purview() p
    where p.profile_id = promotion_cases.subject_profile_id
  )
);

drop policy if exists promotion_case_events_select on public.promotion_case_events;
create policy promotion_case_events_select on public.promotion_case_events
for select to authenticated
using (
  exists (
    select 1 from public.promotion_cases pc
    where pc.id = promotion_case_events.promotion_case_id
  )
);

create or replace function app_private.promotion_actor_label(p_profile_id uuid)
returns text
language sql stable security definer set search_path=''
as $$
  select trim(concat_ws(' ', p.rank, p.display_name))
  from public.personnel_profiles p
  where p.id=p_profile_id
$$;
revoke all on function app_private.promotion_actor_label(uuid) from public, anon, authenticated;

create or replace function app_private.validate_promotion_target(p_subject uuid, p_requested_rank text)
returns table(current_rank text, subject_status text, subject_is_test boolean)
language plpgsql stable security definer set search_path=''
as $$
declare
  v_rank text;
  v_status text;
  v_test boolean;
begin
  select p.rank,p.status,p.is_test_account into v_rank,v_status,v_test
  from public.personnel_profiles p where p.id=p_subject;
  if v_rank is null then raise exception 'Personnel profile not found'; end if;
  if v_status not in ('Active','Acting') then raise exception 'Promotion review requires active or acting personnel status'; end if;
  if app_private.rank_level(p_requested_rank) is null then raise exception 'Invalid requested rank'; end if;
  if p_requested_rank='Sheriff' then raise exception 'Sheriff rank is not available through the promotion workflow'; end if;
  if app_private.rank_level(p_requested_rank) <= app_private.rank_level(v_rank) then raise exception 'Requested rank must be higher than the member''s current rank'; end if;
  if exists(select 1 from public.promotion_cases pc where pc.subject_profile_id=p_subject and pc.status in ('Submitted','Under Review')) then
    raise exception 'An active promotion review already exists for this member';
  end if;
  return query select v_rank,v_status,coalesce(v_test,false);
end;
$$;
revoke all on function app_private.validate_promotion_target(uuid,text) from public, anon, authenticated;

create or replace function public.submit_promotion_review_request(p_requested_rank text, p_statement text)
returns public.promotion_cases
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=app_private.current_profile_id();
  v_current_rank text;
  v_status text;
  v_test boolean;
  v_case public.promotion_cases;
  v_label text;
begin
  if v_actor is null then raise exception 'Authenticated personnel account required'; end if;
  if coalesce(length(trim(p_statement)),0)<10 then raise exception 'Explain why you are requesting promotion review'; end if;
  select * into v_current_rank,v_status,v_test from app_private.validate_promotion_target(v_actor,trim(p_requested_rank));
  v_label:=app_private.promotion_actor_label(v_actor);
  insert into public.promotion_cases(subject_profile_id,source_type,initiated_by_profile_id,current_rank,requested_rank,statement,status,is_test_record)
  values(v_actor,'Self Request',v_actor,v_current_rank,trim(p_requested_rank),trim(p_statement),'Submitted',v_test)
  returning * into v_case;
  insert into public.promotion_case_events(promotion_case_id,event_type,actor_profile_id,actor_label,detail,to_status)
  values(v_case.id,'Review Requested',v_actor,v_label,trim(p_statement),'Submitted');
  return v_case;
end;
$$;

create or replace function public.recommend_promotion(p_subject_profile_id uuid, p_requested_rank text, p_statement text)
returns public.promotion_cases
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=app_private.current_profile_id();
  v_actor_rank text;
  v_current_rank text;
  v_status text;
  v_test boolean;
  v_case public.promotion_cases;
  v_label text;
begin
  if v_actor is null then raise exception 'Authenticated personnel account required'; end if;
  if v_actor=p_subject_profile_id then raise exception 'Use the personnel promotion-review request for your own record'; end if;
  if coalesce(length(trim(p_statement)),0)<10 then raise exception 'Enter the reason for the promotion recommendation'; end if;
  if not exists(select 1 from public.get_personnel_in_my_purview() p where p.profile_id=p_subject_profile_id) then
    raise exception 'You do not have supervisory authority for this member';
  end if;
  select rank into v_actor_rank from public.personnel_profiles where id=v_actor;
  select * into v_current_rank,v_status,v_test from app_private.validate_promotion_target(p_subject_profile_id,trim(p_requested_rank));
  if app_private.rank_level(trim(p_requested_rank)) >= app_private.rank_level(v_actor_rank) then
    raise exception 'A supervisor may only recommend a promotion to a rank below their own';
  end if;
  v_label:=app_private.promotion_actor_label(v_actor);
  insert into public.promotion_cases(subject_profile_id,source_type,initiated_by_profile_id,current_rank,requested_rank,statement,status,is_test_record)
  values(p_subject_profile_id,'Supervisor Recommendation',v_actor,v_current_rank,trim(p_requested_rank),trim(p_statement),'Submitted',v_test)
  returning * into v_case;
  insert into public.promotion_case_events(promotion_case_id,event_type,actor_profile_id,actor_label,detail,to_status)
  values(v_case.id,'Supervisor Recommended',v_actor,v_label,trim(p_statement),'Submitted');
  insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
  values(p_subject_profile_id,'Personnel','Promotion review opened','A supervisor recommended you for promotion to '||trim(p_requested_rank)||'.','/portal/my-office#promotion-review');
  return v_case;
end;
$$;

create or replace function public.initiate_promotion_review(p_subject_profile_id uuid, p_requested_rank text, p_statement text)
returns public.promotion_cases
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=app_private.current_profile_id();
  v_actor_rank text;
  v_current_rank text;
  v_status text;
  v_test boolean;
  v_case public.promotion_cases;
  v_label text;
begin
  select rank into v_actor_rank from public.personnel_profiles where id=v_actor;
  if v_actor is null or v_actor_rank not in ('Sheriff','Undersheriff','Major','Captain') then raise exception 'Command authority required'; end if;
  if v_actor=p_subject_profile_id then raise exception 'Command members may not initiate their own promotion review'; end if;
  if coalesce(length(trim(p_statement)),0)<10 then raise exception 'Enter the reason for opening this promotion review'; end if;
  select * into v_current_rank,v_status,v_test from app_private.validate_promotion_target(p_subject_profile_id,trim(p_requested_rank));
  if app_private.rank_level(trim(p_requested_rank)) >= app_private.rank_level(v_actor_rank) then
    raise exception 'Command may only initiate promotion review to a rank below the initiating member''s rank';
  end if;
  v_label:=app_private.promotion_actor_label(v_actor);
  insert into public.promotion_cases(subject_profile_id,source_type,initiated_by_profile_id,current_rank,requested_rank,statement,status,is_test_record)
  values(p_subject_profile_id,'Command Initiated',v_actor,v_current_rank,trim(p_requested_rank),trim(p_statement),'Under Review',v_test)
  returning * into v_case;
  insert into public.promotion_case_events(promotion_case_id,event_type,actor_profile_id,actor_label,detail,to_status)
  values(v_case.id,'Command Review Opened',v_actor,v_label,trim(p_statement),'Under Review');
  insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
  values(p_subject_profile_id,'Personnel','Promotion review opened','Command opened a promotion review for '||trim(p_requested_rank)||'.','/portal/my-office#promotion-review');
  return v_case;
end;
$$;

create or replace function public.begin_promotion_case_review(p_case_id uuid, p_notes text default null)
returns public.promotion_cases
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=app_private.current_profile_id();
  v_rank text;
  v_case public.promotion_cases;
  v_label text;
begin
  select rank into v_rank from public.personnel_profiles where id=v_actor;
  if v_actor is null or v_rank not in ('Sheriff','Undersheriff','Major','Captain') then raise exception 'Command authority required'; end if;
  select * into v_case from public.promotion_cases where id=p_case_id and status='Submitted' for update;
  if v_case.id is null then raise exception 'Promotion case is not available to begin review'; end if;
  v_label:=app_private.promotion_actor_label(v_actor);
  update public.promotion_cases set status='Under Review',updated_at=now() where id=p_case_id returning * into v_case;
  insert into public.promotion_case_events(promotion_case_id,event_type,actor_profile_id,actor_label,detail,from_status,to_status)
  values(p_case_id,'Command Review Started',v_actor,v_label,nullif(trim(coalesce(p_notes,'')),''),'Submitted','Under Review');
  return v_case;
end;
$$;

create or replace function public.decide_promotion_case(p_case_id uuid, p_decision text, p_notes text)
returns public.promotion_cases
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=app_private.current_profile_id();
  v_actor_rank text;
  v_case public.promotion_cases;
  v_subject public.personnel_profiles;
  v_label text;
  v_reason text;
  v_new_tier text;
  v_citizen_id text;
  v_grade integer;
  v_from_status text;
begin
  select rank into v_actor_rank from public.personnel_profiles where id=v_actor;
  if v_actor is null or v_actor_rank not in ('Sheriff','Undersheriff','Major') then raise exception 'Sheriff, Undersheriff, or Major approval required'; end if;
  if p_decision not in ('Approved','Denied') then raise exception 'Decision must be Approved or Denied'; end if;
  if coalesce(length(trim(p_notes)),0)<4 then raise exception 'A short decision reason is required'; end if;
  select * into v_case from public.promotion_cases where id=p_case_id and status in ('Submitted','Under Review') for update;
  if v_case.id is null then raise exception 'Promotion case is not available for decision'; end if;
  v_from_status:=v_case.status;
  if v_case.subject_profile_id=v_actor then raise exception 'Personnel may not decide their own promotion case'; end if;
  select * into v_subject from public.personnel_profiles where id=v_case.subject_profile_id for update;
  if v_subject.status not in ('Active','Acting') then raise exception 'Promotion cannot be approved while the member is not active or acting'; end if;
  if v_subject.rank<>v_case.current_rank then raise exception 'The member''s rank changed after this promotion case was opened; close the case and start a new review'; end if;
  if p_decision='Approved' then
    if app_private.rank_level(v_case.requested_rank)>=app_private.rank_level(v_actor_rank) then raise exception 'You may only approve promotion to a rank below your own'; end if;
    v_new_tier:=app_private.rank_access_tier(v_case.requested_rank);
    if v_new_tier is null then raise exception 'Invalid promotion rank'; end if;
    v_reason:='Promotion review PR-'||lpad(v_case.case_number::text,4,'0')||': '||trim(p_notes);
    update public.personnel_profiles set rank=v_case.requested_rank,access_tier=v_new_tier,updated_at=now() where id=v_case.subject_profile_id;
    insert into public.personnel_career_events(profile_id,event_type,effective_at,from_rank,to_rank,title,notes,recorded_by)
    values(v_case.subject_profile_id,'Promotion',now(),v_case.current_rank,v_case.requested_rank,'Promotion: '||v_case.current_rank||' to '||v_case.requested_rank,v_reason,v_actor);
    insert into public.audit_log(actor_user_id,actor_profile_id,action,table_name,record_id,old_data,new_data)
    values((select auth.uid()),v_actor,'PROMOTION_CASE_APPROVED','personnel_profiles',v_case.subject_profile_id::text,
      jsonb_build_object('rank',v_case.current_rank,'access_tier',v_subject.access_tier,'status',v_subject.status),
      jsonb_build_object('rank',v_case.requested_rank,'access_tier',v_new_tier,'status',v_subject.status,'promotion_case_id',v_case.id,'reason',v_reason));
    if app_private.fivem_portal_integration_enabled() then
      select fil.citizen_id into v_citizen_id from public.fivem_identity_links fil where fil.personnel_profile_id=v_case.subject_profile_id and fil.active=true order by fil.linked_at desc limit 1;
      if v_citizen_id is not null then
        v_grade:=app_private.lscso_grade_for_rank(v_case.requested_rank);
        insert into public.fivem_personnel_sync_actions(personnel_profile_id,citizen_id,desired_rank,desired_grade,desired_status,reason,actor_profile_id)
        values(v_case.subject_profile_id,v_citizen_id,v_case.requested_rank,v_grade,v_subject.status,v_reason,v_actor);
      end if;
    end if;
  end if;
  v_label:=app_private.promotion_actor_label(v_actor);
  update public.promotion_cases
  set status=p_decision,decision_notes=trim(p_notes),decided_by_profile_id=v_actor,decided_at=now(),effective_at=case when p_decision='Approved' then now() else null end,updated_at=now()
  where id=p_case_id returning * into v_case;
  insert into public.promotion_case_events(promotion_case_id,event_type,actor_profile_id,actor_label,detail,from_status,to_status)
  values(p_case_id,case when p_decision='Approved' then 'Promotion Approved' else 'Promotion Denied' end,v_actor,v_label,trim(p_notes),v_from_status,p_decision);
  insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
  values(v_case.subject_profile_id,'Personnel',case when p_decision='Approved' then 'Promotion approved' else 'Promotion review closed' end,
    case when p_decision='Approved' then 'Your promotion to '||v_case.requested_rank||' has been approved.' else 'Your promotion review was not approved. Reason: '||trim(p_notes) end,
    '/portal/my-office#promotion-review');
  return v_case;
end;
$$;

create or replace function public.withdraw_promotion_review(p_case_id uuid, p_reason text default null)
returns public.promotion_cases
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=app_private.current_profile_id();
  v_case public.promotion_cases;
  v_label text;
  v_from_status text;
begin
  select * into v_case from public.promotion_cases where id=p_case_id and subject_profile_id=v_actor and source_type='Self Request' and status in ('Submitted','Under Review') for update;
  if v_case.id is null then raise exception 'Only your active self-requested promotion review may be withdrawn'; end if;
  v_from_status:=v_case.status;
  v_label:=app_private.promotion_actor_label(v_actor);
  update public.promotion_cases set status='Withdrawn',decision_notes=nullif(trim(coalesce(p_reason,'')),''),decided_at=now(),updated_at=now() where id=p_case_id returning * into v_case;
  insert into public.promotion_case_events(promotion_case_id,event_type,actor_profile_id,actor_label,detail,from_status,to_status)
  values(p_case_id,'Review Withdrawn',v_actor,v_label,nullif(trim(coalesce(p_reason,'')),''),v_from_status,'Withdrawn');
  return v_case;
end;
$$;

revoke all on function public.submit_promotion_review_request(text,text) from public, anon;
revoke all on function public.recommend_promotion(uuid,text,text) from public, anon;
revoke all on function public.initiate_promotion_review(uuid,text,text) from public, anon;
revoke all on function public.begin_promotion_case_review(uuid,text) from public, anon;
revoke all on function public.decide_promotion_case(uuid,text,text) from public, anon;
revoke all on function public.withdraw_promotion_review(uuid,text) from public, anon;
grant execute on function public.submit_promotion_review_request(text,text) to authenticated;
grant execute on function public.recommend_promotion(uuid,text,text) to authenticated;
grant execute on function public.initiate_promotion_review(uuid,text,text) to authenticated;
grant execute on function public.begin_promotion_case_review(uuid,text) to authenticated;
grant execute on function public.decide_promotion_case(uuid,text,text) to authenticated;
grant execute on function public.withdraw_promotion_review(uuid,text) to authenticated;

drop trigger if exists promotion_cases_updated_at on public.promotion_cases;
create trigger promotion_cases_updated_at before update on public.promotion_cases for each row execute function app_private.set_updated_at();
drop trigger if exists promotion_cases_audit on public.promotion_cases;
create trigger promotion_cases_audit after insert or update or delete on public.promotion_cases for each row execute function app_private.write_audit_log();
