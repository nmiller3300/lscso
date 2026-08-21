-- V2 directed personnel actions and conflict recusals.

create or replace function app_private.current_can_direct_department_action()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.rank in ('Sheriff','Undersheriff','Major','Captain')
    from public.personnel_profiles p
    where p.auth_user_id = (select auth.uid())
      and p.status in ('Active','Acting')
    limit 1
  ), false)
$$;

create policy directed_personnel_actions_read on public.directed_personnel_actions
for select to authenticated using (
  actor_profile_id = app_private.current_profile_id()
  or directed_by = app_private.current_profile_id()
  or app_private.current_has_department_operational_authority()
);

create policy personnel_recusals_read on public.personnel_recusals
for select to authenticated using (
  recused_profile_id = app_private.current_profile_id()
  or replacement_profile_id = app_private.current_profile_id()
  or app_private.current_has_department_operational_authority()
);

create or replace function public.v2_direct_personnel_action(
  p_actor_profile_id uuid,
  p_subject_profile_id uuid,
  p_capability text,
  p_expires_at timestamptz,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_director uuid := app_private.current_profile_id();
  v_id uuid;
begin
  if not app_private.current_can_direct_department_action() then raise exception 'Command authority required'; end if;
  if p_actor_profile_id = p_subject_profile_id then raise exception 'Actor and subject must differ'; end if;
  if p_capability not in ('create_guardian','review_guardian','add_personnel_flag','request_certification','upload_personnel_document') then raise exception 'Invalid directed capability'; end if;
  if p_expires_at <= now() then raise exception 'Expiration must be in the future'; end if;
  if not exists (select 1 from public.personnel_profiles where id=p_actor_profile_id and status in ('Active','Acting')) then raise exception 'Actor not found'; end if;
  if not exists (select 1 from public.personnel_profiles where id=p_subject_profile_id and status <> 'Deactivated') then raise exception 'Subject not found'; end if;

  insert into public.directed_personnel_actions(actor_profile_id,subject_profile_id,capability,directed_by,reason,expires_at)
  values (p_actor_profile_id,p_subject_profile_id,p_capability,v_director,p_reason,p_expires_at)
  returning id into v_id;

  insert into public.audit_log(actor_user_id,actor_profile_id,action,table_name,record_id,new_data)
  values ((select auth.uid()),v_director,'V2_DIRECT_PERSONNEL_ACTION','directed_personnel_actions',v_id::text,
    jsonb_build_object('actor_profile_id',p_actor_profile_id,'subject_profile_id',p_subject_profile_id,'capability',p_capability,'expires_at',p_expires_at,'reason',p_reason));
  return v_id;
end;
$$;

create or replace function public.has_directed_personnel_action(
  p_subject_profile_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.directed_personnel_actions d
    where d.actor_profile_id = app_private.current_profile_id()
      and d.subject_profile_id = p_subject_profile_id
      and d.capability = p_capability
      and d.starts_at <= now()
      and d.expires_at > now()
      and d.completed_at is null
      and d.revoked_at is null
  )
$$;

create or replace function public.v2_complete_directed_action(p_directed_action_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
begin
  update public.directed_personnel_actions
  set completed_at = now()
  where id = p_directed_action_id
    and actor_profile_id = v_actor
    and completed_at is null
    and revoked_at is null;
  if not found then raise exception 'Active directed action not found'; end if;
  insert into public.audit_log(actor_user_id,actor_profile_id,action,table_name,record_id,new_data)
  values ((select auth.uid()),v_actor,'V2_COMPLETE_DIRECTED_ACTION','directed_personnel_actions',p_directed_action_id::text,jsonb_build_object('completed_at',now()));
end;
$$;

create or replace function public.v2_recuse_personnel_from_matter(
  p_recused_profile_id uuid,
  p_subject_profile_id uuid,
  p_matter_type text,
  p_matter_record_id text default null,
  p_replacement_profile_id uuid default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
  v_id uuid;
begin
  if not app_private.current_can_direct_department_action() then raise exception 'Command authority required'; end if;
  if trim(coalesce(p_reason,'')) = '' then raise exception 'Recusal reason required'; end if;
  if p_matter_type not in ('Guardian','Personnel','Training','Certification','Leave','Investigation','Other') then raise exception 'Invalid matter type'; end if;
  if p_recused_profile_id = p_subject_profile_id then raise exception 'Recused and subject must differ'; end if;
  if p_replacement_profile_id = p_recused_profile_id then raise exception 'Replacement cannot be the recused person'; end if;

  insert into public.personnel_recusals(recused_profile_id,subject_profile_id,matter_type,matter_record_id,replacement_profile_id,reason,imposed_by)
  values (p_recused_profile_id,p_subject_profile_id,p_matter_type,p_matter_record_id,p_replacement_profile_id,trim(p_reason),v_actor)
  returning id into v_id;

  insert into public.audit_log(actor_user_id,actor_profile_id,action,table_name,record_id,new_data)
  values ((select auth.uid()),v_actor,'V2_PERSONNEL_RECUSAL','personnel_recusals',v_id::text,
    jsonb_build_object('recused_profile_id',p_recused_profile_id,'subject_profile_id',p_subject_profile_id,'matter_type',p_matter_type,'matter_record_id',p_matter_record_id,'replacement_profile_id',p_replacement_profile_id,'reason',trim(p_reason)));
  return v_id;
end;
$$;

create or replace function public.is_recused_from_personnel_matter(
  p_subject_profile_id uuid,
  p_matter_type text,
  p_matter_record_id text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.personnel_recusals r
    where r.recused_profile_id = app_private.current_profile_id()
      and r.subject_profile_id = p_subject_profile_id
      and r.matter_type = p_matter_type
      and r.ends_at is null
      and (r.matter_record_id is null or p_matter_record_id is null or r.matter_record_id = p_matter_record_id)
  )
$$;

revoke all on function public.v2_direct_personnel_action(uuid,uuid,text,timestamptz,text) from public, anon;
revoke all on function public.has_directed_personnel_action(uuid,text) from public, anon;
revoke all on function public.v2_complete_directed_action(uuid) from public, anon;
revoke all on function public.v2_recuse_personnel_from_matter(uuid,uuid,text,text,uuid,text) from public, anon;
revoke all on function public.is_recused_from_personnel_matter(uuid,text,text) from public, anon;

grant execute on function public.v2_direct_personnel_action(uuid,uuid,text,timestamptz,text) to authenticated;
grant execute on function public.has_directed_personnel_action(uuid,text) to authenticated;
grant execute on function public.v2_complete_directed_action(uuid) to authenticated;
grant execute on function public.v2_recuse_personnel_from_matter(uuid,uuid,text,text,uuid,text) to authenticated;
grant execute on function public.is_recused_from_personnel_matter(uuid,text,text) to authenticated;
