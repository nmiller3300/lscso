create unique index if not exists personnel_unit_assignments_one_active_primary
  on public.personnel_unit_assignments(profile_id)
  where assignment_type = 'Primary' and ends_at is null;

create or replace function app_private.sync_new_personnel_primary_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unit_name text;
  v_unit_id uuid;
begin
  v_unit_name := case trim(coalesce(new.division, ''))
    when 'Field Operations' then 'Patrol Division'
    when 'Training & FTO' then 'Training & Recruitment'
    when 'Academy' then 'Training & Recruitment'
    when '' then null
    when 'Unassigned' then null
    else trim(new.division)
  end;

  if v_unit_name is null then
    return new;
  end if;

  select ou.id
    into v_unit_id
  from public.organizational_units ou
  where ou.active and ou.name = v_unit_name
  order by ou.sort_order, ou.created_at
  limit 1;

  if v_unit_id is null then
    return new;
  end if;

  if new.division is distinct from v_unit_name then
    update public.personnel_profiles
      set division = v_unit_name
    where id = new.id;
  end if;

  insert into public.personnel_unit_assignments(
    profile_id,
    organizational_unit_id,
    assignment_type,
    assigned_by,
    notes
  ) values (
    new.id,
    v_unit_id,
    'Primary',
    null,
    'Initial primary assignment created with personnel account'
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists personnel_profiles_sync_initial_assignment on public.personnel_profiles;
create trigger personnel_profiles_sync_initial_assignment
after insert on public.personnel_profiles
for each row
execute function app_private.sync_new_personnel_primary_assignment();
