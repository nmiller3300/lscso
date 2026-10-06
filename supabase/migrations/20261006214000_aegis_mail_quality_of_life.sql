alter table public.lscso_mail_deliveries
  add column if not exists is_starred boolean not null default false;

create index if not exists lscso_mail_deliveries_starred_idx
  on public.lscso_mail_deliveries(recipient_profile_id, is_starred, created_at desc)
  where is_starred = true;

create table if not exists public.lscso_mail_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.personnel_profiles(id) on delete cascade,
  from_address text not null check (from_address = lower(from_address) and from_address ~ '^[a-z0-9][a-z0-9._-]{1,62}@lscso\.gov$'),
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  bcc_addresses text[] not null default '{}',
  subject text not null default '',
  body text not null default '',
  reply_to_message_id uuid references public.lscso_mail_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lscso_mail_drafts_owner_idx
  on public.lscso_mail_drafts(owner_profile_id, updated_at desc);

alter table public.lscso_mail_drafts enable row level security;

comment on table public.lscso_mail_drafts is 'Server-side autosaved drafts for the native AEGIS LSCSO Mail client.';
