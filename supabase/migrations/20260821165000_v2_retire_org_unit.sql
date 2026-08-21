-- Retire organizational units without deleting structural history.
create or replace function public.v2_retire_organizational_unit(
  p_unit_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
  v_old jsonb;
begin
  if not app_private.current_is_executive() then
    raise exception 'Executive authority required';
  end if;

  select to_jsonb(u) into v_old
  from public.organizational_units u
  where u.id = p_unit_id and u.active;

  if v_old is null then raise exception 'Active unit not found'; end if;

  if exists (
    select 1 from public.organizational_units
    where parent_unit_id = p_unit_id and active
  ) then raise exception 'Move or retire active child units first'; end if;

  if exists (
    select 1 from public.personnel_unit_assignments
    where organizational_unit_id = p_unit_id and ends_at is null
  ) then raise exception 'End active personnel assignments first'; end if;

  if exists (
    select 1 from public.supervisory_authorities
    where organizational_unit_id = p_unit_id and ends_at is null
  ) then raise exception 'End active supervisory authority first'; end if;

  update public.organizational_units
  set active = false,
      retired_at = now(),
      retired_by = v_actor
  where id = p_unit_id;

  insert into public.audit_log(actor_user_id, actor_profile_id, action, table_name, record_id, old_data, new_data)
  values (
    (select auth.uid()),
    v_actor,
    'V2_RETIRE_ORGANIZATIONAL_UNIT',
    'organizational_units',
    p_unit_id::text,
    v_old,
    jsonb_build_object('active', false, 'retired_at', now(), 'reason', p_reason)
  );
end;
$$;

revoke all on function public.v2_retire_organizational_unit(uuid,text) from public, anon;
grant execute on function public.v2_retire_organizational_unit(uuid,text) to authenticated;
