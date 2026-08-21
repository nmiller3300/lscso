-- Seed V2 organizational structure from existing LSCSO division labels.
-- Legacy division data remains intact for compatibility during cutover.

do $$
declare
  v_root uuid;
begin
  select id into v_root
  from public.organizational_units
  where lower(name) = 'lscso' and parent_unit_id is null and active
  limit 1;

  if v_root is null then
    insert into public.organizational_units(name, unit_type, parent_unit_id)
    values ('LSCSO', 'Bureau', null)
    returning id into v_root;
  end if;

  insert into public.organizational_units(name, unit_type, parent_unit_id)
  select d.division, 'Division', v_root
  from (
    select distinct trim(division) as division
    from public.personnel_profiles
    where division is not null and trim(division) not in ('','Unassigned')
    union
    select distinct trim(division)
    from public.division_assignments
    where division is not null and trim(division) not in ('','Unassigned')
  ) d
  where not exists (
    select 1 from public.organizational_units ou
    where lower(ou.name) = lower(d.division)
      and ou.parent_unit_id = v_root
      and ou.active
  );

  insert into public.personnel_unit_assignments(profile_id, organizational_unit_id, assignment_type, starts_at, assigned_by, notes)
  select da.profile_id,
         ou.id,
         case da.assignment_type when 'Primary' then 'Primary' when 'Secondary' then 'Secondary' when 'Temporary' then 'Temporary' else 'Secondary' end,
         da.effective_at,
         da.assigned_by,
         coalesce(da.notes, 'Migrated from legacy division assignment')
  from public.division_assignments da
  join public.organizational_units ou
    on lower(ou.name) = lower(trim(da.division))
   and ou.parent_unit_id = v_root
   and ou.active
  where da.ends_at is null
    and not exists (
      select 1 from public.personnel_unit_assignments pua
      where pua.profile_id = da.profile_id
        and pua.organizational_unit_id = ou.id
        and pua.assignment_type = case da.assignment_type when 'Primary' then 'Primary' when 'Secondary' then 'Secondary' when 'Temporary' then 'Temporary' else 'Secondary' end
        and pua.ends_at is null
    );

  insert into public.personnel_unit_assignments(profile_id, organizational_unit_id, assignment_type, starts_at, notes)
  select p.id, ou.id, 'Primary', coalesce(p.created_at, now()), 'Migrated from personnel profile division'
  from public.personnel_profiles p
  join public.organizational_units ou
    on lower(ou.name) = lower(trim(p.division))
   and ou.parent_unit_id = v_root
   and ou.active
  where p.status <> 'Deactivated'
    and trim(coalesce(p.division,'')) not in ('','Unassigned')
    and not exists (
      select 1 from public.personnel_unit_assignments pua
      where pua.profile_id = p.id and pua.ends_at is null
    );
end $$;
