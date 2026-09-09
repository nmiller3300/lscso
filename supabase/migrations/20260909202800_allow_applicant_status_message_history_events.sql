alter table public.recruitment_application_history
  drop constraint if exists recruitment_application_history_event_type_check;

alter table public.recruitment_application_history
  add constraint recruitment_application_history_event_type_check
  check (event_type = any (array[
    'Submitted'::text,
    'Reviewer Assigned'::text,
    'Status Changed'::text,
    'Approved for Interview'::text,
    'Interview Updated'::text,
    'Note Added'::text,
    'Accepted'::text,
    'Denied'::text,
    'Hired In Game'::text,
    'Applicant Status Message Updated'::text,
    'Applicant Status Message Cleared'::text
  ]));
