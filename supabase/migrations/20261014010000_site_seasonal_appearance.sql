-- Persistent global theme for LSCSO. Other department data is untouched.
-- The only released options are the original look and Halloween.
create table if not exists public.site_seasonal_appearance (
  id text primary key check (id = 'global'),
  active_theme text not null default 'standard'
    check (active_theme in ('standard','halloween')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.personnel_profiles(id) on delete set null
);
alter table public.site_seasonal_appearance enable row level security;
revoke all on public.site_seasonal_appearance from anon, authenticated;
insert into public.site_seasonal_appearance (id, active_theme)
values ('global', 'halloween') on conflict (id) do nothing;
