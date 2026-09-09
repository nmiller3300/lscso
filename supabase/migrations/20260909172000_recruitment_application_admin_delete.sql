grant delete on table public.recruitment_applications to authenticated;

drop policy if exists recruitment_applications_executive_delete on public.recruitment_applications;
create policy recruitment_applications_executive_delete
on public.recruitment_applications
for delete
to authenticated
using (
  (select app_private.current_roster_rank()) in ('Sheriff', 'Undersheriff')
  and hired_profile_id is null
  and status <> 'Hired'
);

create or replace function app_private.audit_recruitment_application_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
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
    app_private.current_profile_id(),
    'DELETE_RECRUITMENT_APPLICATION',
    'recruitment_applications',
    old.id::text,
    jsonb_build_object(
      'application_number', old.application_number,
      'status', old.status,
      'submitted_at', old.submitted_at,
      'had_tracking_link', old.applicant_tracking_token_hash is not null
    ),
    null
  );
  return old;
end;
$$;

revoke all on function app_private.audit_recruitment_application_delete() from public, anon, authenticated;
grant execute on function app_private.audit_recruitment_application_delete() to postgres, service_role;

drop trigger if exists recruitment_application_delete_audit on public.recruitment_applications;
create trigger recruitment_application_delete_audit
before delete on public.recruitment_applications
for each row
execute function app_private.audit_recruitment_application_delete();
