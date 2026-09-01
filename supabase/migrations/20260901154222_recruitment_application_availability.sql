create table if not exists public.recruitment_settings (
  id text primary key,
  applications_open boolean not null default false,
  updated_by_profile_id uuid references public.personnel_profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint recruitment_settings_singleton check (id = 'applications')
);

alter table public.recruitment_settings enable row level security;

insert into public.recruitment_settings (id, applications_open)
values ('applications', false)
on conflict (id) do nothing;

create index if not exists recruitment_settings_updated_by_profile_idx
  on public.recruitment_settings(updated_by_profile_id);

revoke all on table public.recruitment_settings from anon, authenticated;
grant select (id, applications_open, updated_at) on public.recruitment_settings to anon;
grant select, insert, update on table public.recruitment_settings to authenticated;

drop policy if exists "Public can read recruitment availability" on public.recruitment_settings;
create policy "Public can read recruitment availability"
on public.recruitment_settings
for select
to anon, authenticated
using (id = 'applications');

drop policy if exists "Command can insert recruitment availability" on public.recruitment_settings;
create policy "Command can insert recruitment availability"
on public.recruitment_settings
for insert
to authenticated
with check (
  id = 'applications'
  and (select app_private.current_access_tier()) = any (array['Executive'::text, 'Command'::text])
  and updated_by_profile_id = (select app_private.current_profile_id())
);

drop policy if exists "Command can update recruitment availability" on public.recruitment_settings;
create policy "Command can update recruitment availability"
on public.recruitment_settings
for update
to authenticated
using (
  id = 'applications'
  and (select app_private.current_access_tier()) = any (array['Executive'::text, 'Command'::text])
)
with check (
  id = 'applications'
  and (select app_private.current_access_tier()) = any (array['Executive'::text, 'Command'::text])
  and updated_by_profile_id = (select app_private.current_profile_id())
);

create or replace function app_private.audit_recruitment_availability_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_log (
    actor_user_id,
    actor_profile_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) values (
    auth.uid(),
    new.updated_by_profile_id,
    case
      when new.applications_open then 'Opened recruitment applications'
      else 'Closed recruitment applications'
    end,
    'recruitment_settings',
    new.id,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );
  return new;
end;
$$;

revoke all on function app_private.audit_recruitment_availability_change() from public;

drop trigger if exists recruitment_settings_audit_trigger on public.recruitment_settings;
create trigger recruitment_settings_audit_trigger
after insert or update on public.recruitment_settings
for each row execute function app_private.audit_recruitment_availability_change();
