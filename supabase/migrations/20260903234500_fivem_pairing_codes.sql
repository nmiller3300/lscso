create unique index if not exists fivem_identity_links_one_active_profile_idx
  on public.fivem_identity_links (personnel_profile_id)
  where active = true;

create table public.fivem_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  personnel_profile_id uuid not null references public.personnel_profiles(id) on delete cascade,
  code_hash text not null check (char_length(code_hash) = 64),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index fivem_pairing_codes_active_hash_idx
  on public.fivem_pairing_codes (code_hash)
  where consumed_at is null;

create index fivem_pairing_codes_profile_idx
  on public.fivem_pairing_codes (personnel_profile_id, expires_at desc);

alter table public.fivem_pairing_codes enable row level security;

-- Pairing codes are created by the authenticated portal API and redeemed only
-- by the authenticated FiveM server integration. Browser clients never receive
-- direct table access.
revoke all on table public.fivem_pairing_codes from anon, authenticated;
grant all on table public.fivem_pairing_codes to service_role;
