-- LSCSO V2 organizational authority foundation
-- Additive migration. Legacy division/supervisor fields remain for compatibility
-- until Command Structure migration/cutover is explicitly completed.

create table public.organizational_units (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  unit_type text not null check (unit_type in ('Bureau','Division','Unit','Team','Detail','Program','Shift')),
  parent_unit_id uuid references public.organizational_units(id) on delete restrict,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.personnel_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retired_at timestamptz,
  retired_by uuid references public.personnel_profiles(id) on delete set null,
  check (parent_unit_id is null or parent_unit_id <> id)
);

create unique index organizational_units_active_name_parent_unique
  on public.organizational_units (lower(name), coalesce(parent_unit_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where active;
create index organizational_units_parent_idx on public.organizational_units(parent_unit_id, active, sort_order);

create table public.personnel_unit_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  organizational_unit_id uuid not null references public.organizational_units(id) on delete restrict,
  assignment_type text not null check (assignment_type in ('Primary','Secondary','Special','Temporary','Training')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  assigned_by uuid references public.personnel_profiles(id) on delete set null,
  ended_by uuid references public.personnel_profiles(id) on delete set null,
  end_reason text,
  notes text,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create unique index personnel_unit_assignments_active_unique
  on public.personnel_unit_assignments(profile_id, organizational_unit_id, assignment_type)
  where ends_at is null;
create unique index personnel_unit_assignments_one_primary_unique
  on public.personnel_unit_assignments(profile_id)
  where assignment_type = 'Primary' and ends_at is null;
create index personnel_unit_assignments_unit_idx
  on public.personnel_unit_assignments(organizational_unit_id, ends_at, profile_id);
create index personnel_unit_assignments_profile_idx
  on public.personnel_unit_assignments(profile_id, ends_at, starts_at desc);

create table public.supervisory_authorities (
  id uuid primary key default gen_random_uuid(),
  supervisor_profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  authority_type text not null check (authority_type in ('Primary','Unit','Command','Training','Temporary','Conflict Reassignment')),
  organizational_unit_id uuid references public.organizational_units(id) on delete restrict,
  subject_profile_id uuid references public.personnel_profiles(id) on delete restrict,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  granted_by uuid references public.personnel_profiles(id) on delete set null,
  ended_by uuid references public.personnel_profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check ((organizational_unit_id is not null)::int + (subject_profile_id is not null)::int = 1),
  check (subject_profile_id is null or subject_profile_id <> supervisor_profile_id)
);

create unique index supervisory_authorities_active_unit_unique
  on public.supervisory_authorities(supervisor_profile_id, authority_type, organizational_unit_id)
  where ends_at is null and organizational_unit_id is not null;
create unique index supervisory_authorities_active_person_unique
  on public.supervisory_authorities(supervisor_profile_id, authority_type, subject_profile_id)
  where ends_at is null and subject_profile_id is not null;
create index supervisory_authorities_supervisor_idx
  on public.supervisory_authorities(supervisor_profile_id, ends_at, starts_at desc);
create index supervisory_authorities_unit_idx
  on public.supervisory_authorities(organizational_unit_id, ends_at);
create index supervisory_authorities_subject_idx
  on public.supervisory_authorities(subject_profile_id, ends_at);

create table public.directed_personnel_actions (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  subject_profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  capability text not null check (capability in (
    'create_guardian','review_guardian','add_personnel_flag','request_certification','upload_personnel_document'
  )),
  directed_by uuid not null references public.personnel_profiles(id) on delete restrict,
  reason text,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.personnel_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (actor_profile_id <> subject_profile_id),
  check (expires_at > starts_at)
);
create index directed_personnel_actions_actor_idx
  on public.directed_personnel_actions(actor_profile_id, subject_profile_id, capability, expires_at)
  where completed_at is null and revoked_at is null;

create table public.personnel_recusals (
  id uuid primary key default gen_random_uuid(),
  recused_profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  subject_profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  matter_type text not null check (matter_type in ('Guardian','Personnel','Training','Certification','Leave','Investigation','Other')),
  matter_record_id text,
  replacement_profile_id uuid references public.personnel_profiles(id) on delete restrict,
  reason text not null,
  imposed_by uuid references public.personnel_profiles(id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  ended_by uuid references public.personnel_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (recused_profile_id <> subject_profile_id),
  check (replacement_profile_id is null or replacement_profile_id <> recused_profile_id),
  check (ends_at is null or ends_at > starts_at)
);
create index personnel_recusals_active_idx
  on public.personnel_recusals(recused_profile_id, subject_profile_id, matter_type)
  where ends_at is null;

create table public.personnel_career_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  event_type text not null check (event_type in ('Appointment','Promotion','Demotion','Rank Correction','Transfer','Reassignment','Reinstatement','Separation','Retirement','Other')),
  effective_at timestamptz not null,
  from_rank text,
  to_rank text,
  title text not null check (char_length(title) between 2 and 180),
  notes text,
  recorded_by uuid references public.personnel_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index personnel_career_events_profile_idx
  on public.personnel_career_events(profile_id, effective_at desc, created_at desc);

create trigger organizational_units_set_updated_at
before update on public.organizational_units
for each row execute function app_private.set_updated_at();

alter table public.organizational_units enable row level security;
alter table public.personnel_unit_assignments enable row level security;
alter table public.supervisory_authorities enable row level security;
alter table public.directed_personnel_actions enable row level security;
alter table public.personnel_recusals enable row level security;
alter table public.personnel_career_events enable row level security;

create or replace function app_private.current_has_department_operational_authority()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.rank in ('Sheriff','Undersheriff','Major','Captain')
    from public.personnel_profiles p
    where p.auth_user_id = (select auth.uid())
      and p.status in ('Active','Acting')
    limit 1
  ), false)
$$;

create or replace function public.get_personnel_in_my_purview()
returns table (
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
language sql
stable
security definer
set search_path = ''
as $$
  with recursive me as (
    select p.id, p.rank
    from public.personnel_profiles p
    where p.auth_user_id = (select auth.uid())
      and p.status in ('Active','Acting')
    limit 1
  ),
  unit_tree as (
    select sa.id as authority_id,
           sa.supervisor_profile_id,
           sa.authority_type,
           ou.id as unit_id,
           ou.name as unit_name
    from public.supervisory_authorities sa
    join public.organizational_units ou on ou.id = sa.organizational_unit_id
    join me on me.id = sa.supervisor_profile_id
    where sa.ends_at is null
      and sa.organizational_unit_id is not null
      and ou.active
    union all
    select ut.authority_id,
           ut.supervisor_profile_id,
           ut.authority_type,
           child.id,
           child.name
    from unit_tree ut
    join public.organizational_units child on child.parent_unit_id = ut.unit_id
    where child.active
  ),
  scoped as (
    select p.id as profile_id,
           p.personnel_id,
           p.display_name,
           p.rank,
           p.call_sign,
           p.status,
           a.organizational_unit_id,
           ou.name as organizational_unit_name,
           a.assignment_type,
           case sa.authority_type
             when 'Training' then 'training'
             when 'Temporary' then 'temporary_assignment'
             when 'Conflict Reassignment' then 'conflict_reassignment'
             when 'Primary' then 'direct'
             else 'unit'
           end::text as scope,
           sa.authority_type
    from public.supervisory_authorities sa
    join me on me.id = sa.supervisor_profile_id
    join public.personnel_profiles p on p.id = sa.subject_profile_id
    left join public.personnel_unit_assignments a on a.profile_id = p.id and a.ends_at is null
    left join public.organizational_units ou on ou.id = a.organizational_unit_id
    where sa.ends_at is null
      and sa.subject_profile_id is not null
      and p.status <> 'Deactivated'

    union

    select p.id,
           p.personnel_id,
           p.display_name,
           p.rank,
           p.call_sign,
           p.status,
           a.organizational_unit_id,
           ut.unit_name,
           a.assignment_type,
           case ut.authority_type
             when 'Training' then 'training'
             when 'Temporary' then 'temporary_assignment'
             when 'Command' then 'command_chain'
             when 'Primary' then 'unit'
             else 'unit'
           end::text,
           ut.authority_type
    from unit_tree ut
    join public.personnel_unit_assignments a
      on a.organizational_unit_id = ut.unit_id
     and a.ends_at is null
    join public.personnel_profiles p on p.id = a.profile_id
    where p.status <> 'Deactivated'
  )
  select distinct s.profile_id, s.personnel_id, s.display_name, s.rank, s.call_sign, s.status,
         s.organizational_unit_id, s.organizational_unit_name, s.assignment_type, s.scope, s.authority_type
  from scoped s
  order by s.display_name, s.organizational_unit_name nulls last;
$$;

revoke all on function public.get_personnel_in_my_purview() from public, anon;
grant execute on function public.get_personnel_in_my_purview() to authenticated;

create policy organizational_units_read on public.organizational_units
for select to authenticated using (active or app_private.current_access_tier() in ('Executive','Command'));

create policy personnel_unit_assignments_read on public.personnel_unit_assignments
for select to authenticated using (
  profile_id = app_private.current_profile_id()
  or app_private.current_has_department_operational_authority()
  or exists (
    select 1 from public.get_personnel_in_my_purview() p where p.profile_id = personnel_unit_assignments.profile_id
  )
);

create policy supervisory_authorities_read on public.supervisory_authorities
for select to authenticated using (
  supervisor_profile_id = app_private.current_profile_id()
  or subject_profile_id = app_private.current_profile_id()
  or app_private.current_has_department_operational_authority()
);

create policy personnel_career_events_read on public.personnel_career_events
for select to authenticated using (
  profile_id = app_private.current_profile_id()
  or app_private.current_has_department_operational_authority()
  or exists (
    select 1 from public.get_personnel_in_my_purview() p where p.profile_id = personnel_career_events.profile_id
  )
);

-- Directed actions and recusals are intentionally not broadly selectable through
-- table RLS yet; action-specific RPCs will expose only what the actor requires.
