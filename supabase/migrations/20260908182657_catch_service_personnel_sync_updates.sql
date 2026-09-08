create or replace function app_private.enqueue_service_personnel_sync_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce((select auth.jwt()->>'role'), '');
  v_citizen_id text;
  v_grade integer;
begin
  if v_role <> 'service_role' then return new; end if;
  if new.status = 'Deactivated' then return new; end if;
  if old.rank is not distinct from new.rank and old.status is not distinct from new.status then return new; end if;

  select fil.citizen_id into v_citizen_id
  from public.fivem_identity_links fil
  where fil.personnel_profile_id=new.id and fil.active=true
  order by fil.linked_at desc
  limit 1;

  if v_citizen_id is null then return new; end if;
  v_grade:=app_private.lscso_grade_for_rank(new.rank);
  if v_grade is null then return new; end if;

  insert into public.fivem_personnel_sync_actions(
    personnel_profile_id,citizen_id,desired_rank,desired_grade,desired_status,reason,actor_profile_id
  ) values (
    new.id,v_citizen_id,new.rank,v_grade,new.status,'Personnel account status synchronization',null
  );

  return new;
end;
$$;

drop trigger if exists personnel_profiles_service_fivem_sync on public.personnel_profiles;
create trigger personnel_profiles_service_fivem_sync
after update of rank,status on public.personnel_profiles
for each row
when (old.rank is distinct from new.rank or old.status is distinct from new.status)
execute function app_private.enqueue_service_personnel_sync_update();

revoke execute on function app_private.enqueue_service_personnel_sync_update() from public, anon, authenticated;
