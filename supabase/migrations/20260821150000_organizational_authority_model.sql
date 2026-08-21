-- Preview-only migration for Command Portal V2.
-- Do not apply to production until the LSCSO authority matrix and UI are approved.

create table if not exists public.organizational_units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  unit_type text not null check (unit_type in ('Department','Bureau','Division','Section','Unit','Team','Detail','Program')),
  parent_unit_id uuid references public.organizational_units(id) on delete restrict,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, parent_unit_id)
);

create table if not exists public.personnel_unit_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  organizational_unit_id uuid not null references public.organizational_units(id) on delete restrict,
  assignment_type text not null check (assignment_type in ('Primary','Secondary','Special','Temporary','Training')),
  assignment_title text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  assigned_by uuid references public.personnel_profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists personnel_unit_assignments_profile_idx
  on public.personnel_unit_assignments(profile_id, starts_at desc);
create index if not exists personnel_unit_assignments_unit_idx
  on public.personnel_unit_assignments(organizational_unit_id, starts_at desc);

create table if not exists public.supervisory_authority (
  id uuid primary key default gen_random_uuid(),
  supervisor_profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  organizational_unit_id uuid references public.organizational_units(id) on delete restrict,
  subject_profile_id uuid references public.personnel_profiles(id) on delete restrict,
  authority_type text not null check (authority_type in ('Primary','Unit','Command','Training','Temporary')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  granted_by uuid references public.personnel_profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (organizational_unit_id is not null or subject_profile_id is not null),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists supervisory_authority_supervisor_idx
  on public.supervisory_authority(supervisor_profile_id, starts_at desc);
create index if not exists supervisory_authority_unit_idx
  on public.supervisory_authority(organizational_unit_id, starts_at desc);
create index if not exists supervisory_authority_subject_idx
  on public.supervisory_authority(subject_profile_id, starts_at desc);

alter table public.organizational_units enable row level security;
alter table public.personnel_unit_assignments enable row level security;
alter table public.supervisory_authority enable row level security;

-- Recursive helper: a unit is in scope when it is the assigned unit or descends from it.
create or replace function app_private.unit_is_within_scope(target_unit uuid, authority_unit uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive descendants as (
    select u.id
    from public.organizational_units u
    where u.id = authority_unit
    union all
    select child.id
    from public.organizational_units child
    join descendants parent on child.parent_unit_id = parent.id
    where child.active
  )
  select exists(select 1 from descendants where id = target_unit);
$$;

-- Returns every active authority relationship explaining why actor may have scope over target.
create or replace function public.get_personnel_authority_scopes(target_profile_id uuid)
returns table(scope text, authority_type text, organizational_unit_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with caller as (
    select app_private.current_profile_id() as profile_id,
           app_private.current_access_tier() as access_tier
  ),
  target_assignments as (
    select a.organizational_unit_id
    from public.personnel_unit_assignments a
    where a.profile_id = target_profile_id
      and a.starts_at <= now()
      and (a.ends_at is null or a.ends_at > now())
  ),
  active_authority as (
    select sa.*
    from public.supervisory_authority sa, caller c
    where sa.supervisor_profile_id = c.profile_id
      and sa.starts_at <= now()
      and (sa.ends_at is null or sa.ends_at > now())
  )
  select 'self'::text, 'Self'::text, null::uuid
  from caller c where c.profile_id = target_profile_id

  union all

  select
    case aa.authority_type
      when 'Primary' then 'direct'
      when 'Unit' then 'unit'
      when 'Command' then 'command_chain'
      when 'Training' then 'training'
      when 'Temporary' then 'temporary'
      else 'unit'
    end,
    aa.authority_type,
    aa.organizational_unit_id
  from active_authority aa
  where aa.subject_profile_id = target_profile_id
     or (
       aa.organizational_unit_id is not null
       and exists (
         select 1
         from target_assignments ta
         where app_private.unit_is_within_scope(ta.organizational_unit_id, aa.organizational_unit_id)
       )
     )

  union all

  select 'department'::text, 'Executive'::text, null::uuid
  from caller c where c.access_tier = 'Executive';
$$;

-- Read policies are intentionally broad enough to support discovery while still respecting scope.
-- Mutation RPCs should call get_personnel_authority_scopes and enforce capability-specific rules.
create policy organizational_units_read on public.organizational_units
for select to authenticated
using (active or app_private.current_access_tier() in ('Executive','Command'));

create policy personnel_unit_assignments_read on public.personnel_unit_assignments
for select to authenticated
using (
  profile_id = app_private.current_profile_id()
  or app_private.current_access_tier() in ('Executive','Command')
  or exists (
    select 1 from public.get_personnel_authority_scopes(profile_id) s
    where s.scope in ('direct','unit','command_chain','training','temporary')
  )
);

create policy supervisory_authority_read on public.supervisory_authority
for select to authenticated
using (
  supervisor_profile_id = app_private.current_profile_id()
  or subject_profile_id = app_private.current_profile_id()
  or app_private.current_access_tier() in ('Executive','Command')
);

-- No direct insert/update/delete policies on assignments or supervisory authority.
-- Those mutations must go through audited SECURITY DEFINER RPCs once the final matrix is approved.
