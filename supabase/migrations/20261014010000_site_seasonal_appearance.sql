-- Global cosmetic theme. Public viewers only read server-rendered sanitized settings.
-- All writes are performed through Sheriff-gated server actions using the service role.
create table if not exists public.site_seasonal_appearance (
  id text primary key check (id = 'global'),
  active_theme text not null default 'standard' check (active_theme in ('standard','halloween','thanksgiving','christmas')),
  intensity text not null default 'medium' check (intensity in ('low','medium','high')),
  effects jsonb not null default '{"leaves":true,"bats":true,"lightning":true,"moon":true,"fog":true,"pumpkins":true,"liquid":true}'::jsonb,
  logos jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.personnel_profiles(id) on delete set null
);
alter table public.site_seasonal_appearance enable row level security;
revoke all on public.site_seasonal_appearance from anon, authenticated;
insert into public.site_seasonal_appearance (id, active_theme)
values ('global', 'halloween') on conflict (id) do nothing;
-- Seasonal patch files are bundled as static website assets; no upload bucket needed.\n