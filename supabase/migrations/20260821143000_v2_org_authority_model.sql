-- COMMAND PORTAL V2 PREVIEW ONLY
-- This migration is intentionally committed to the preview branch and has not
-- been applied to production. It establishes the organizational relationships
-- required by the centralized authorization engine.

create table if not exists public.organizational_units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  unit_type text not null check (unit_type in ('Office','Bureau','Division','Section','Unit','Team','Shift','Detail')),
  parent_unit_id uuid references public.organizational_units(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, parent_unit_id)
);

comment on table public.organizational_units is
  'Hierarchical LSCSO organizational structure. Parent relationships allow bureau, division, shift, team, and detail command chains.';

create table if not exists public.personnel_unit_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  unit_id uuid not null references public.organizational_units(id) on delete restrict,
  assignment_type text not null check (assignment_type in ('Primary','Secondary','Special','Temporary')),
  duty_title text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  assigned_by uuid references public.personnel_profiles(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

comment on table public.personnel_unit_assignments is
  'A member may hold multiple simultaneous LSCSO assignments. Certifications do not create assignments or supervisory authority.';

create index if not exists personnel_unit_assignments_profile_active_idx
  on public.personnel_unit_assignments(profile_id, starts_at, ends_at);
create index if not exists personnel_unit_assignments_unit_active_idx
  on public.personnel_unit_assignments(unit_id, starts_at, ends_at);

create table if not exists public.supervisory_authority_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  unit_id uuid not null references public.organizational_units(id) on delete restrict,
  authority_type text not null check (authority_type in ('Command','Supervisory','Limited Supervisory')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  assigned_by uuid references public.personnel_profiles(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

comment on table public.supervisory_authority_assignments is
  'Defines standing organizational purview for 1st Lieutenant and below. Captain and above retain standing department-wide operational authority independent of home unit.';

create index if not exists supervisory_authority_profile_active_idx
  on public.supervisory_authority_assignments(profile_id, starts_at, ends_at);
create index if not exists supervisory_authority_unit_active_idx
  on public.supervisory_authority_assignments(unit_id, starts_at, ends_at);

create table if not exists public.directed_authority_actions (
  id uuid primary key default gen_random_uuid(),
  assignee_profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  subject_profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  directed_by uuid not null references public.personnel_profiles(id) on delete restrict,
  capability text not null check (capability in (
    'create_guardian',
    'review_guardian',
    'add_personnel_flag',
    'request_certification',
    'upload_personnel_document',
    'add_training_record',
    'evaluate_trainee'
  )),
  reason text not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.personnel_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

comment on table public.directed_authority_actions is
  'Specific out-of-purview task authority. It never changes the Guardian type, organizational assignment, or general access to the subject.';

create index if not exists directed_authority_assignee_active_idx
  on public.directed_authority_actions(assignee_profile_id, subject_profile_id, expires_at)
  where completed_at is null and revoked_at is null;

create table if not exists public.authority_recusals (
  id uuid primary key default gen_random_uuid(),
  recused_profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  subject_profile_id uuid references public.personnel_profiles(id) on delete restrict,
  matter_type text not null check (matter_type in ('Guardian','Personnel Action','Training','Certification','Administrative Review','Other')),
  matter_id uuid,
  reassigned_to_profile_id uuid references public.personnel_profiles(id) on delete restrict,
  reason text not null,
  imposed_by uuid not null references public.personnel_profiles(id) on delete restrict,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  lifted_by uuid references public.personnel_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

comment on table public.authority_recusals is
  'Matter-specific conflict-of-interest recusal. A recusal does not rewrite the normal chain of command.';

create index if not exists authority_recusals_active_idx
  on public.authority_recusals(recused_profile_id, subject_profile_id, matter_type, matter_id)
  where ends_at is null;

-- Existing division_assignments and acting_supervisor_grants are retained during
-- migration. V2 rollout will reconcile them into the new model rather than
-- deleting or silently changing historical data.

alter table public.organizational_units enable row level security;
alter table public.personnel_unit_assignments enable row level security;
alter table public.supervisory_authority_assignments enable row level security;
alter table public.directed_authority_actions enable row level security;
alter table public.authority_recusals enable row level security;

-- Deliberately no permissive RLS policies in this draft migration. Before this
-- schema can be applied to production, read/write policies and SECURITY DEFINER
-- RPCs must be built against the finalized centralized authority evaluator.
