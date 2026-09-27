create table if not exists public.current_administration (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.personnel_profiles(id) on delete set null,
  display_name text not null,
  rank text not null,
  position_title text not null,
  call_sign text,
  portrait_url text,
  public_bio text,
  responsibilities text[] not null default '{}',
  appointment_status text not null default 'Permanent' check (appointment_status in ('Permanent', 'Acting')),
  start_date date,
  display_order integer not null default 100 check (display_order >= 0),
  is_public boolean not null default true,
  is_active boolean not null default true,
  created_by uuid references public.personnel_profiles(id) on delete set null,
  updated_by uuid references public.personnel_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists current_administration_public_order_idx
  on public.current_administration (is_active, is_public, display_order);

alter table public.current_administration enable row level security;

-- Managed only by authenticated server actions using the service-role client.
-- Public visitors receive a deliberately limited projection through the function below.

create or replace function public.get_public_current_administration()
returns table (
  id uuid,
  display_name text,
  rank text,
  position_title text,
  call_sign text,
  portrait_url text,
  public_bio text,
  responsibilities text[],
  appointment_status text,
  display_order integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ca.id,
    ca.display_name,
    ca.rank,
    ca.position_title,
    ca.call_sign,
    ca.portrait_url,
    ca.public_bio,
    ca.responsibilities,
    ca.appointment_status,
    ca.display_order
  from public.current_administration ca
  where ca.is_active = true
    and ca.is_public = true
  order by ca.display_order asc, ca.rank asc, ca.display_name asc;
$$;

revoke all on function public.get_public_current_administration() from public;
grant execute on function public.get_public_current_administration() to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'administration-portraits',
  'administration-portraits',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/avif']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into public.current_administration (
  profile_id, display_name, rank, position_title, call_sign, public_bio,
  responsibilities, appointment_status, display_order, is_public, is_active
)
select
  p.id,
  p.display_name,
  p.rank,
  case p.rank
    when 'Sheriff' then 'Executive head of the Sheriff''s Office'
    when 'Undersheriff' then 'Second in command'
    when 'Major' then case when nullif(p.division, '') is not null and p.division <> 'Unassigned' then 'Major · ' || p.division else 'Major' end
    when '1st Lieutenant' then case when nullif(p.division, '') is not null and p.division <> 'Unassigned' then 'First Lieutenant · ' || p.division else 'First Lieutenant' end
    else p.rank
  end,
  p.call_sign,
  case p.rank
    when 'Sheriff' then 'The Sheriff establishes department-wide direction, sets the standard expected of the organization, and holds final executive authority over LSCSO operations, personnel, policy, and command decisions.'
    when 'Undersheriff' then 'The Undersheriff turns executive direction into coordinated action, maintains continuity across command functions, and acts with the authority of the Sheriff when assigned or required.'
    when 'Major' then 'As a member of senior command, the Major carries executive direction into assigned operational areas, coordinates department priorities, and provides command-level oversight across the Office.'
    when '1st Lieutenant' then 'The First Lieutenant supports command operations through senior supervision, coordination, and the execution of department priorities within assigned areas of responsibility.'
    else 'Member of the current administration of the Los Santos County Sheriff''s Office.'
  end,
  case p.rank
    when 'Sheriff' then array[
      'Sets agency priorities, executive policy, and organizational standards',
      'Exercises final authority on command appointments and major personnel decisions',
      'Directs department-wide operations, structure, and long-term development',
      'Represents the Sheriff''s Office in executive and interagency matters'
    ]::text[]
    when 'Undersheriff' then array[
      'Coordinates command staff and department-wide implementation',
      'Maintains executive oversight of readiness, staffing, and accountability',
      'Resolves cross-division issues that require senior command action',
      'Assumes executive authority when acting on behalf of the Sheriff'
    ]::text[]
    else '{}'::text[]
  end,
  'Permanent',
  case p.rank
    when 'Sheriff' then 10
    when 'Undersheriff' then 20
    when 'Major' then 30 + row_number() over (partition by p.rank order by p.call_sign nulls last, p.display_name)::integer
    when '1st Lieutenant' then 50
    else 100
  end,
  true,
  true
from public.personnel_profiles p
where p.status in ('Active', 'Acting')
  and p.rank in ('Sheriff', 'Undersheriff', 'Major', '1st Lieutenant')
on conflict (profile_id) do nothing;
