create or replace function app_private.enforce_recruitment_interview_failure_closure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
begin
  if new.interview_status = 'Failed'
     and old.interview_status is distinct from 'Failed'
     and new.hired_profile_id is null then
    new.status := 'Archived';
    new.recruitment_closed_at := coalesce(new.recruitment_closed_at, now());
    new.recruitment_closed_by_profile_id := coalesce(new.recruitment_closed_by_profile_id, v_actor);
    new.recruitment_closure_code := 'Interview Failed';
    new.recruitment_closure_reason := 'The selection process was closed because the applicant did not successfully complete the required interview.';
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function app_private.enforce_recruitment_interview_failure_closure() from public, anon, authenticated;

drop trigger if exists recruitment_interview_failure_closure on public.recruitment_applications;
create trigger recruitment_interview_failure_closure
before update of interview_status on public.recruitment_applications
for each row
execute function app_private.enforce_recruitment_interview_failure_closure();

create or replace function app_private.log_recruitment_interview_failure_closure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.interview_status = 'Failed'
     and old.interview_status is distinct from 'Failed'
     and new.recruitment_closure_code = 'Interview Failed' then
    insert into public.recruitment_application_history(application_id, actor_profile_id, event_type, details)
    values (
      new.id,
      new.recruitment_closed_by_profile_id,
      'Application Closed',
      jsonb_build_object(
        'closure_code', 'Interview Failed',
        'reason', new.recruitment_closure_reason,
        'interview_result_recorded', new.interview_result is not null
      )
    );
  end if;
  return new;
end;
$$;

revoke all on function app_private.log_recruitment_interview_failure_closure() from public, anon, authenticated;

drop trigger if exists recruitment_interview_failure_closure_history on public.recruitment_applications;
create trigger recruitment_interview_failure_closure_history
after update of interview_status on public.recruitment_applications
for each row
execute function app_private.log_recruitment_interview_failure_closure();
