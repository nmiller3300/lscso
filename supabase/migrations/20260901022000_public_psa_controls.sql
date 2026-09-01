create table if not exists public.site_psa (
  id text primary key,
  message text not null,
  is_active boolean not null default false,
  updated_by_profile_id uuid references public.personnel_profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint site_psa_singleton check (id = 'homepage'),
  constraint site_psa_message_length check (char_length(btrim(message)) between 1 and 240)
);

alter table public.site_psa enable row level security;

insert into public.site_psa (id, message, is_active)
values (
  'homepage',
  'LSCSO HAS TEMPORARY STATEWIDE JURISDICTION BY ORDER OF THE GOVERNOR',
  true
)
on conflict (id) do nothing;

create index if not exists site_psa_updated_by_profile_idx
  on public.site_psa(updated_by_profile_id);
