create or replace function app_private.set_personnel_probation_window()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.is_test_account then
    new.probation_started_at := null;
    new.probation_ends_at := null;
  elsif new.probation_started_at is null and new.probation_ends_at is null then
    new.probation_started_at := coalesce(new.created_at, now());
    new.probation_ends_at := coalesce(new.created_at, now()) + interval '15 days';
  end if;
  return new;
end;
$$;

drop trigger if exists set_personnel_probation_window on public.personnel_profiles;
create trigger set_personnel_probation_window
before insert on public.personnel_profiles
for each row execute function app_private.set_personnel_probation_window();
