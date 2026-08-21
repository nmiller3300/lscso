-- Preview-only migration for Command Portal V2.
-- Do not apply to production until the LSCSO authority matrix and UI are approved.

create table if not exists public.organizational_units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  unit_type text not null check (unit_type in ('Department','Bureau','Division','Section','Unit','Team','Detail','Program','Shift')),
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

-- A directed action authorizes one scoped action or matter without changing the org chart.
-- Example: Sheriff directs a 1st Lieutenant to conduct a Conversation Guardian outside normal purview.
create table if not exists public.directed_personnel_actions (
  id uuid primary key default gen_random_uuid(),
  assignee_profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  subject_profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  capability text not null,
  matter_type text,
  matter_id uuid,
  direction_reason text not null,
  directed_by uuid not null references public.personnel_profiles(id) on delete restrict,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  completed_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.personnel_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (assignee_profile_id <> subject_profile_id),
  check (expires_at is null or expires_at > starts_at)
);

create index if not exists directed_personnel_actions_assignee_idx
  on public.directed_personnel_actions(assignee_profile_id, subject_profile_id, starts_at desc);

-- Recusal removes authority for one matter without changing standing supervision.
create table if not exists public.personnel_matter_recusals (
  id uuid primary key default gen_random_uuid(),
  matter_type text not null,
  matter_id uuid not null,
  recused_profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  replacement_profile_id uuid references public.personnel_profiles(id) on delete restrict,
  reason text not null,
  imposed_by uuid not null references public.personnel_profiles(id) on delete restrict,
  starts_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references public.personnel_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (replacement_profile_id is null or replacement_profile_id <> recused_profile_id)
);

create unique index if not exists active_personnel_matter_recusal_idx
  on public.personnel_matter_recusals(matter_type, matter_id, recused_profile_id)
  where lifted_at is null;

alter table public.organizational_units enable row level security;
alter table public.personnel_unit_assignments enable row level security;
alter table public.supervisory_authority enable row level security;
alter table public.directed_personnel_actions enable row level security;
alter table public.personnel_matter_recusals enable row level security;

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
-- Captain and above receive standing department scope. 1st Lieutenant and below remain scope-bound.
create or replace function public.get_personnel_authority_scopes(target_profile_id uuid)
returns table(scope text, authority_type text, organizational_unit_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with caller as (
    select p.id as profile_id, p.rank, p.access_tier
    from public.personnel_profiles p
    where p.auth_user_id = (select auth.uid())
    limit 1
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

  select 'department'::text, 'Standing Command'::text, null::uuid
  from caller c
  where c.rank in ('Sheriff','Undersheriff','Major','Captain')

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

  select 'directed'::text, 'Directed Action'::text, null::uuid
  from public.directed_personnel_actions da, caller c
  where da.assignee_profile_id = c.profile_id
    and da.subject_profile_id = target_profile_id
    and da.starts_at <= now()
    and (da.expires_at is null or da.expires_at > now())
    and da.completed_at is null
    and da.revoked_at is null;
$$;

create or replace function public.has_active_directed_personnel_action(
  target_profile_id uuid,
  requested_capability text,
  requested_matter_type text default null,
  requested_matter_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.directed_personnel_actions da
    where da.assignee_profile_id = app_private.current_profile_id()
      and da.subject_profile_id = target_profile_id
      and da.capability = requested_capability
      and da.starts_at <= now()
      and (da.expires_at is null or da.expires_at > now())
      and da.completed_at is null
      and da.revoked_at is null
      and (requested_matter_type is null or da.matter_type is null or da.matter_type = requested_matter_type)
      and (requested_matter_id is null or da.matter_id is null or da.matter_id = requested_matter_id)
  );
$$;

create or replace function public.is_recused_from_personnel_matter(
  requested_matter_type text,
  requested_matter_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.personnel_matter_recusals r
    where r.matter_type = requested_matter_type
      and r.matter_id = requested_matter_id
      and r.recused_profile_id = app_private.current_profile_id()
      and r.lifted_at is null
  );
$$;

-- Read policies support discovery but do not grant mutation authority.
create policy organizational_units_read on public.organizational_units
for select to authenticated
using (active or app_private.current_access_tier() in ('Executive','Command'));

create policy personnel_unit_assignments_read on public.personnel_unit_assignments
for select to authenticated
using (
  profile_id = app_private.current_profile_id()
  or (select rank from public.personnel_profiles where id = app_private.current_profile_id()) in ('Sheriff','Undersheriff','Major','Captain')
  or exists (
    select 1 from public.get_personnel_authority_scopes(profile_id) s
    where s.scope in ('direct','unit','command_chain','training','temporary','directed')
  )
);

create policy supervisory_authority_read on public.supervisory_authority
for select to authenticated
using (
  supervisor_profile_id = app_private.current_profile_id()
  or subject_profile_id = app_private.current_profile_id()
  or (select rank from public.personnel_profiles where id = app_private.current_profile_id()) in ('Sheriff','Undersheriff','Major','Captain')
);

create policy directed_personnel_actions_read on public.directed_personnel_actions
for select to authenticated
using (
  assignee_profile_id = app_private.current_profile_id()
  or directed_by = app_private.current_profile_id()
  or (select rank from public.personnel_profiles where id = app_private.current_profile_id()) in ('Sheriff','Undersheriff','Major','Captain')
);

create policy personnel_matter_recusals_read on public.personnel_matter_recusals
for select to authenticated
using (
  recused_profile_id = app_private.current_profile_id()
  or replacement_profile_id = app_private.current_profile_id()
  or imposed_by = app_private.current_profile_id()
  or (select rank from public.personnel_profiles where id = app_private.current_profile_id()) in ('Sheriff','Undersheriff','Major','Captain')
);

-- No direct insert/update/delete policies on authority records.
-- Mutations must go through audited SECURITY DEFINER RPCs after the matrix is approved.
