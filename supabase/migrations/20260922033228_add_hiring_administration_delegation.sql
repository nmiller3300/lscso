alter table public.personnel_delegations drop constraint if exists personnel_delegations_delegation_type_check;
alter table public.personnel_delegations
  add constraint personnel_delegations_delegation_type_check
  check (delegation_type = any (array[
    'Personnel Administration'::text,
    'Training Administration'::text,
    'Division Administration'::text,
    'Hiring Administration'::text,
    'Temporary Command Authority'::text
  ]));

create or replace function app_private.profile_has_active_delegation(
  p_profile_id uuid,
  p_delegation_type text,
  p_unit_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.personnel_delegations d
    where d.profile_id = p_profile_id
      and d.delegation_type = p_delegation_type
      and d.starts_at <= now()
      and d.revoked_at is null
      and (d.expires_at is null or d.expires_at > now())
      and (p_unit_id is null or d.organizational_unit_id = p_unit_id)
  );
$function$;

create or replace function app_private.current_has_hiring_authority()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(app_private.current_access_tier() in ('Executive','Command'), false)
    or app_private.current_has_active_delegation('Hiring Administration');
$function$;

create or replace function app_private.profile_has_hiring_authority(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.personnel_profiles p
    where p.id = p_profile_id
      and p.status in ('Active','Acting')
      and (
        p.access_tier in ('Executive','Command')
        or app_private.profile_has_active_delegation(p.id, 'Hiring Administration')
      )
  );
$function$;

revoke all on function app_private.profile_has_active_delegation(uuid,text,uuid) from public;
revoke all on function app_private.current_has_hiring_authority() from public;
revoke all on function app_private.profile_has_hiring_authority(uuid) from public;
grant execute on function app_private.profile_has_active_delegation(uuid,text,uuid) to authenticated;
grant execute on function app_private.current_has_hiring_authority() to authenticated;
grant execute on function app_private.profile_has_hiring_authority(uuid) to authenticated;

create or replace function app_private.can_edit_recruitment_application_form()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.personnel_profiles p
    where p.auth_user_id = auth.uid()
      and p.status in ('Active', 'Acting')
      and p.rank in ('Sheriff', 'Undersheriff')
  ) or app_private.current_has_active_delegation('Hiring Administration');
$function$;

do $migration$
declare
  v_def text;
  v_old text := $needle$p_delegation_type not in ('Personnel Administration','Training Administration','Division Administration','Temporary Command Authority')$needle$;
  v_new text := $needle$p_delegation_type not in ('Personnel Administration','Training Administration','Division Administration','Hiring Administration','Temporary Command Authority')$needle$;
begin
  select pg_get_functiondef('public.grant_personnel_delegation(uuid,text,uuid,timestamptz,text)'::regprocedure) into v_def;
  if position(v_old in v_def) = 0 then raise exception 'grant_personnel_delegation whitelist signature changed'; end if;
  execute replace(v_def, v_old, v_new);
end
$migration$;

drop policy if exists recruitment_applications_command_select on public.recruitment_applications;
drop policy if exists recruitment_applications_hiring_select on public.recruitment_applications;
create policy recruitment_applications_hiring_select on public.recruitment_applications
for select to authenticated using (app_private.current_has_hiring_authority());

drop policy if exists recruitment_application_notes_command_select on public.recruitment_application_notes;
drop policy if exists recruitment_application_notes_hiring_select on public.recruitment_application_notes;
create policy recruitment_application_notes_hiring_select on public.recruitment_application_notes
for select to authenticated using (app_private.current_has_hiring_authority());

drop policy if exists recruitment_application_history_command_select on public.recruitment_application_history;
drop policy if exists recruitment_application_history_hiring_select on public.recruitment_application_history;
create policy recruitment_application_history_hiring_select on public.recruitment_application_history
for select to authenticated using (app_private.current_has_hiring_authority());

drop policy if exists recruitment_applicant_messages_command_select on public.recruitment_applicant_messages;
drop policy if exists recruitment_applicant_messages_hiring_select on public.recruitment_applicant_messages;
create policy recruitment_applicant_messages_hiring_select on public.recruitment_applicant_messages
for select to authenticated using (app_private.current_has_hiring_authority());

drop policy if exists recruitment_employment_offers_command_read on public.recruitment_employment_offers;
drop policy if exists recruitment_employment_offers_hiring_read on public.recruitment_employment_offers;
create policy recruitment_employment_offers_hiring_read on public.recruitment_employment_offers
for select to authenticated using (app_private.current_has_hiring_authority());

drop policy if exists "Command can insert recruitment availability" on public.recruitment_settings;
drop policy if exists "Hiring authority can insert recruitment availability" on public.recruitment_settings;
create policy "Hiring authority can insert recruitment availability" on public.recruitment_settings
for insert to authenticated
with check (id = 'applications' and app_private.current_has_hiring_authority() and updated_by_profile_id = app_private.current_profile_id());

drop policy if exists "Command can update recruitment availability" on public.recruitment_settings;
drop policy if exists "Hiring authority can update recruitment availability" on public.recruitment_settings;
create policy "Hiring authority can update recruitment availability" on public.recruitment_settings
for update to authenticated
using (id = 'applications' and app_private.current_has_hiring_authority())
with check (id = 'applications' and app_private.current_has_hiring_authority() and updated_by_profile_id = app_private.current_profile_id());

do $migration$
declare
  v_def text;
  v_old text;
begin
  select pg_get_functiondef('public.command_recruitment_application_action(uuid,text,jsonb)'::regprocedure) into v_def;
  v_old := $needle$v_tier not in ('Executive', 'Command')$needle$;
  if position(v_old in v_def) = 0 then raise exception 'command_recruitment_application_action gate changed'; end if;
  v_def := replace(v_def, v_old, 'not app_private.current_has_hiring_authority()');
  v_def := replace(v_def, $needle$v_reviewer_tier not in ('Executive', 'Command')$needle$, 'not app_private.profile_has_hiring_authority(v_reviewer_id)');
  v_def := replace(v_def, $needle$v_interviewer_tier not in ('Executive','Command')$needle$, 'not app_private.profile_has_hiring_authority(v_interviewer_id)');
  execute v_def;

  select pg_get_functiondef('public.command_recruitment_interview_action(uuid,jsonb)'::regprocedure) into v_def;
  v_old := $needle$v_tier not in ('Executive','Command')$needle$;
  if position(v_old in v_def) = 0 then raise exception 'command_recruitment_interview_action gate changed'; end if;
  v_def := replace(v_def, v_old, 'not app_private.current_has_hiring_authority()');
  v_def := replace(v_def, $needle$v_interviewer_tier not in ('Executive','Command')$needle$, 'not app_private.profile_has_hiring_authority(v_interviewer_id)');
  execute v_def;

  select pg_get_functiondef('public.command_department_attorney_application_action(uuid,text,jsonb)'::regprocedure) into v_def;
  v_old := $needle$v_tier not in ('Executive', 'Command')$needle$;
  if position(v_old in v_def) = 0 then raise exception 'command_department_attorney_application_action gate changed'; end if;
  v_def := replace(v_def, v_old, 'not app_private.current_has_hiring_authority()');
  v_def := replace(v_def, $needle$v_reviewer_tier not in ('Executive', 'Command')$needle$, 'not app_private.profile_has_hiring_authority(v_reviewer_id)');
  v_def := replace(v_def, $needle$v_interviewer_tier not in ('Executive','Command')$needle$, 'not app_private.profile_has_hiring_authority(v_interviewer_id)');
  execute v_def;

  select pg_get_functiondef('public.command_reopen_recruitment_no_show(uuid)'::regprocedure) into v_def;
  v_old := $needle$v_tier not in ('Executive','Command')$needle$;
  if position(v_old in v_def) = 0 then raise exception 'command_reopen_recruitment_no_show gate changed'; end if;
  execute replace(v_def, v_old, 'not app_private.current_has_hiring_authority()');

  select pg_get_functiondef('public.record_recruit_hire_from_portal(uuid,text,text,text,integer)'::regprocedure) into v_def;
  v_old := $needle$v_access_tier not in ('Executive', 'Command')$needle$;
  if position(v_old in v_def) = 0 then raise exception 'record_recruit_hire_from_portal gate changed'; end if;
  execute replace(v_def, v_old, 'not app_private.current_has_hiring_authority()');

  select pg_get_functiondef('public.record_recruit_hire_website_only(uuid)'::regprocedure) into v_def;
  v_old := $needle$v_access_tier not in ('Executive','Command')$needle$;
  if position(v_old in v_def) = 0 then raise exception 'record_recruit_hire_website_only gate changed'; end if;
  execute replace(v_def, v_old, 'not app_private.current_has_hiring_authority()');

  select pg_get_functiondef('public.record_department_attorney_hire_website_only(uuid)'::regprocedure) into v_def;
  v_old := $needle$v_access_tier not in ('Executive','Command')$needle$;
  if position(v_old in v_def) = 0 then raise exception 'record_department_attorney_hire_website_only gate changed'; end if;
  execute replace(v_def, v_old, 'not app_private.current_has_hiring_authority()');

  select pg_get_functiondef('public.send_recruitment_applicant_message(uuid,text)'::regprocedure) into v_def;
  v_old := $needle$(select app_private.current_access_tier()) <> all (array['Executive'::text, 'Command'::text])$needle$;
  if position(v_old in v_def) = 0 then raise exception 'send_recruitment_applicant_message gate changed'; end if;
  execute replace(v_def, v_old, 'not app_private.current_has_hiring_authority()');

  select pg_get_functiondef('public.reissue_recruitment_tracking_token(uuid)'::regprocedure) into v_def;
  v_old := $needle$v_tier not in ('Executive', 'Command')$needle$;
  if position(v_old in v_def) = 0 then raise exception 'reissue_recruitment_tracking_token gate changed'; end if;
  execute replace(v_def, v_old, 'not app_private.current_has_hiring_authority()');
end
$migration$;
