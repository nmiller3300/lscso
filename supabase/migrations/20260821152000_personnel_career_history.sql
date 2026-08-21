-- Preview-only migration for Command Portal V2.
-- Do not apply to production until V2 personnel history is approved.

create table if not exists public.personnel_career_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  event_type text not null check (event_type in (
    'Appointment',
    'Promotion',
    'Demotion',
    'Rank Correction',
    'Reinstatement',
    'Separation',
    'Retirement'
  )),
  prior_rank text,
  new_rank text,
  effective_at timestamptz not null default now(),
  authorized_by uuid references public.personnel_profiles(id) on delete set null,
  reason text,
  source_record_id uuid,
  created_at timestamptz not null default now(),
  check (
    event_type not in ('Promotion','Demotion','Rank Correction')
    or (prior_rank is not null and new_rank is not null and prior_rank <> new_rank)
  )
);

create index if not exists personnel_career_events_profile_idx
  on public.personnel_career_events(profile_id, effective_at desc);

alter table public.personnel_career_events enable row level security;

create policy personnel_career_events_read on public.personnel_career_events
for select to authenticated
using (
  profile_id = app_private.current_profile_id()
  or (select rank from public.personnel_profiles where id = app_private.current_profile_id()) in ('Sheriff','Undersheriff','Major','Captain')
  or exists (
    select 1
    from public.get_personnel_authority_scopes(profile_id) scope_row
    where scope_row.scope in ('direct','unit','command_chain','temporary','directed')
  )
);

-- No direct mutation policies. Rank/career changes will be written atomically by
-- audited RPCs so a current-rank update and history event cannot drift apart.

comment on table public.personnel_career_events is
'Immutable career-history events for appointment, promotion, demotion, rank correction, reinstatement, separation, and retirement.';
