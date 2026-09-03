create table public.fivem_identity_links (
  id uuid primary key default gen_random_uuid(),
  personnel_profile_id uuid not null references public.personnel_profiles(id) on delete cascade,
  citizen_id text not null unique check (char_length(citizen_id) between 2 and 100),
  license_identifier text check (
    license_identifier is null or char_length(license_identifier) between 2 and 160
  ),
  active boolean not null default true,
  linked_at timestamptz not null default now(),
  linked_by uuid references public.personnel_profiles(id) on delete set null,
  last_seen_at timestamptz,
  last_seen_grade integer check (last_seen_grade between 0 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fivem_identity_links_profile_idx
  on public.fivem_identity_links (personnel_profile_id, active);

create index fivem_identity_links_license_idx
  on public.fivem_identity_links (license_identifier)
  where license_identifier is not null;

alter table public.fivem_identity_links enable row level security;

-- These links are an integration concern, not portal/browser data. The FiveM API
-- reaches them through a server-only Supabase secret client after authenticating
-- the game server. Browser sessions never receive direct table access.
revoke all on table public.fivem_identity_links from anon, authenticated;
grant all on table public.fivem_identity_links to service_role;
