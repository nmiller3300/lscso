create table if not exists public.certification_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.certification_catalog(name) values
('Basic Peace Officer'),('Advanced Peace Officer'),('Less-Lethal Certification'),('Firearm Certification'),('Firearms Specialist'),('Field Training Officer'),('Supervisor Certification'),('Emergency Vehicle Operations'),('Pursuit Intervention Technique'),('Crisis Intervention Training'),('De-Escalation Certification'),('Taser / Conducted Energy Weapon Certification'),('OC Spray Certification'),('Stop the Bleed / First Aid'),('CPR / AED'),('Traffic Enforcement'),('DUI / Standardized Field Sobriety Testing'),('Radar / LIDAR'),('Criminal Investigations'),('Crime Scene Investigation'),('Evidence Handling'),('Interview & Interrogation'),('Firearms Instructor'),('Less-Lethal Instructor'),('General Instructor'),('FTO Instructor'),('Defensive Tactics Instructor'),('EVOC Instructor'),('SWAT Operator'),('SWAT Marksman'),('Crisis Negotiator'),('K-9 Handler'),('Search & Rescue'),('Drug Recognition Expert'),('Advanced Criminal Investigations'),('Internal Affairs Investigator')
on conflict (name) do nothing;

create table if not exists public.personnel_awards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.personnel_profiles(id) on delete cascade,
  award_name text not null check (award_name in ('Medal of Valor','Medal of Merit','Life Saving Award','Distinguished Service Award','Deputy of the Month')),
  citation text not null,
  awarded_by uuid not null references public.personnel_profiles(id),
  awarded_on date not null default current_date,
  image_asset_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.personnel_flags (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.personnel_profiles(id) on delete cascade,
  flag_type text not null check (flag_type in ('Promotion Eligible','Promotion Hold','Training Required','Certification Deficiency','Administrative Review','Probationary','FTO Eligible','Supervisor Eligible','Command Review Required','Return From LOA Review','Restricted Duty','Separation Pending')),
  notes text,
  active boolean not null default true,
  created_by uuid not null references public.personnel_profiles(id),
  resolved_by uuid references public.personnel_profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity unique,
  profile_id uuid not null references public.personnel_profiles(id) on delete cascade,
  leave_type text not null check (leave_type in ('Personal','Medical','Military','Family','Administrative','Other')),
  starts_on date not null,
  expected_return_on date not null,
  notes text,
  status text not null default 'Submitted' check (status in ('Submitted','In Review','Approved','Denied','Cancelled','Completed')),
  reviewed_by uuid references public.personnel_profiles(id),
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expected_return_on >= starts_on)
);

create table if not exists public.disciplinary_point_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.personnel_profiles(id) on delete cascade,
  event_type text not null check (event_type in ('Discipline','Outstanding Performance','Commendation Restoration','Administrative Correction')),
  delta integer not null check (delta between -3 and 10 and delta <> 0),
  guardian_id uuid references public.guardian_records(id),
  authorized_by uuid references public.personnel_profiles(id),
  reason text not null,
  effective_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists personnel_awards_profile_idx on public.personnel_awards(profile_id, awarded_on desc);
create index if not exists personnel_flags_profile_active_idx on public.personnel_flags(profile_id, active);
create index if not exists leave_requests_profile_idx on public.leave_requests(profile_id, created_at desc);
create index if not exists disciplinary_point_events_profile_idx on public.disciplinary_point_events(profile_id, effective_on desc, created_at desc);

alter table public.certification_catalog enable row level security;
alter table public.personnel_awards enable row level security;
alter table public.personnel_flags enable row level security;
alter table public.leave_requests enable row level security;
alter table public.disciplinary_point_events enable row level security;

revoke all on public.certification_catalog, public.personnel_awards, public.personnel_flags, public.leave_requests, public.disciplinary_point_events from anon, authenticated;
grant select on public.certification_catalog to authenticated;
grant select on public.personnel_awards to authenticated;
grant select on public.personnel_flags to authenticated;
grant select, insert, update on public.leave_requests to authenticated;
grant select on public.disciplinary_point_events to authenticated;

create policy certification_catalog_read on public.certification_catalog for select to authenticated using (active = true);
create policy personnel_awards_read on public.personnel_awards for select to authenticated using (
  profile_id = app_private.current_profile_id() or app_private.current_access_tier() in ('Executive','Command','Supervisor')
);
create policy personnel_flags_read on public.personnel_flags for select to authenticated using (
  profile_id = app_private.current_profile_id() or app_private.current_access_tier() in ('Executive','Command','Supervisor')
);
create policy leave_requests_read on public.leave_requests for select to authenticated using (
  profile_id = app_private.current_profile_id() or app_private.current_access_tier() in ('Executive','Command','Supervisor')
);
create policy leave_requests_insert on public.leave_requests for insert to authenticated with check (
  profile_id = app_private.current_profile_id() and status = 'Submitted'
);
create policy leave_requests_update_self on public.leave_requests for update to authenticated using (
  profile_id = app_private.current_profile_id() and status = 'Submitted'
) with check (
  profile_id = app_private.current_profile_id() and status in ('Submitted','Cancelled')
);
create policy disciplinary_point_events_read on public.disciplinary_point_events for select to authenticated using (
  profile_id = app_private.current_profile_id() or app_private.current_access_tier() in ('Executive','Command','Supervisor')
);

create or replace function public.get_disciplinary_point_total(target_profile_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := app_private.current_profile_id();
  caller_tier text := app_private.current_access_tier();
  total integer;
begin
  if caller is null then raise exception 'Authorized profile required'; end if;
  if caller <> target_profile_id and caller_tier not in ('Executive','Command','Supervisor','Preliminary') then
    raise exception 'Personnel record access denied';
  end if;
  select greatest(coalesce(sum(delta),0),0)::integer into total
  from public.disciplinary_point_events where profile_id = target_profile_id;
  return total;
end; $$;

revoke all on function public.get_disciplinary_point_total(uuid) from public, anon;
grant execute on function public.get_disciplinary_point_total(uuid) to authenticated, service_role;

create or replace function public.award_outstanding_performance(target_profile_id uuid, reason_text text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := app_private.current_profile_id();
  tier text := app_private.current_access_tier();
  current_points integer;
  event_id uuid;
begin
  if caller is null or tier not in ('Executive','Command') then raise exception 'Command authority required'; end if;
  if exists (select 1 from public.disciplinary_point_events e where e.profile_id=target_profile_id and e.event_type='Outstanding Performance' and date_trunc('month',e.effective_on)=date_trunc('month',current_date)) then
    raise exception 'Outstanding Performance restoration already awarded this month';
  end if;
  select public.get_disciplinary_point_total(target_profile_id) into current_points;
  if current_points = 0 then return jsonb_build_object('restored',0,'points',0); end if;
  insert into public.disciplinary_point_events(profile_id,event_type,delta,authorized_by,reason)
  values(target_profile_id,'Outstanding Performance',-1,caller,coalesce(nullif(trim(reason_text),''),'Outstanding Performance')) returning id into event_id;
  return jsonb_build_object('event_id',event_id,'restored',1,'points',greatest(current_points-1,0));
end; $$;

create or replace function public.award_commendation_restoration(target_profile_id uuid, restore_points integer, reason_text text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := app_private.current_profile_id();
  tier text := app_private.current_access_tier();
  current_points integer;
  month_restored integer;
  actual_restore integer;
  event_id uuid;
begin
  if caller is null or tier not in ('Executive','Command') then raise exception 'Department-head authority required'; end if;
  if restore_points not between 1 and 3 then raise exception 'Commendation restoration must be between 1 and 3 points'; end if;
  select coalesce(sum(abs(delta)),0)::integer into month_restored from public.disciplinary_point_events e
    where e.profile_id=target_profile_id and e.event_type='Commendation Restoration' and date_trunc('month',e.effective_on)=date_trunc('month',current_date);
  if month_restored + restore_points > 3 then raise exception 'Maximum commendation restoration is 3 points per month'; end if;
  select public.get_disciplinary_point_total(target_profile_id) into current_points;
  if current_points = 0 then return jsonb_build_object('restored',0,'points',0); end if;
  actual_restore := least(restore_points,current_points);
  insert into public.disciplinary_point_events(profile_id,event_type,delta,authorized_by,reason)
  values(target_profile_id,'Commendation Restoration',-actual_restore,caller,coalesce(nullif(trim(reason_text),''),'Commendation')) returning id into event_id;
  return jsonb_build_object('event_id',event_id,'restored',actual_restore,'points',greatest(current_points-actual_restore,0));
end; $$;

revoke all on function public.award_outstanding_performance(uuid,text), public.award_commendation_restoration(uuid,integer,text) from public, anon, authenticated;
grant execute on function public.award_outstanding_performance(uuid,text), public.award_commendation_restoration(uuid,integer,text) to service_role;

insert into public.disciplinary_point_events(profile_id,event_type,delta,guardian_id,authorized_by,reason,effective_on)
select g.subject_profile_id,'Discipline',g.points_assessed,g.id,g.author_profile_id,'Guardian ' || g.record_type,coalesce(g.incident_at::date,g.created_at::date)
from public.guardian_records g
where g.record_type <> 'Commendation' and g.points_assessed > 0 and g.status in ('Approved','Issued','Awaiting Acknowledgment','Acknowledged','Follow-Up Due','Closed')
and not exists (select 1 from public.disciplinary_point_events e where e.guardian_id=g.id and e.event_type='Discipline');