alter table public.recruitment_applications
  alter column status set default 'Submitted';

alter table public.recruitment_applications
  drop constraint if exists recruitment_applications_status_check;

alter table public.recruitment_applications
  add constraint recruitment_applications_status_check
  check (status in ('Submitted','Under Review','Interview','Accepted','Denied','Withdrawn','Archived'));

alter table public.recruitment_applications
  add column if not exists submitted_at timestamptz not null default now(),
  add column if not exists applicant_auth_user_id uuid;

alter table public.recruitment_applications
  alter column serious_rp_experience drop not null,
  alter column mandatory_training drop not null,
  alter column previous_ranks drop not null,
  alter column supervisory_experience drop not null,
  alter column good_le_roleplayer drop not null,
  alter column lscso_goals drop not null,
  alter column career_path drop not null,
  alter column department_expectations drop not null,
  alter column officer_discretion drop not null,
  alter column radio_communication drop not null,
  alter column scenario_fleeing_vehicle drop not null,
  alter column scenario_warrant drop not null,
  alter column prior_discipline drop not null,
  alter column breaking_character drop not null,
  alter column friend_policy_violation drop not null,
  alter column protect_fellow_officer drop not null,
  alter column honesty_importance drop not null,
  alter column anything_else drop not null,
  alter column self_improvement drop not null,
  alter column policy_agreement drop not null;

alter table public.recruitment_applications
  alter column mandatory_training set default 'Yes',
  alter column prior_discipline set default 'No',
  alter column prior_discipline_explanation set default '',
  alter column policy_agreement set default 'Yes';

create index if not exists recruitment_applications_submitted_idx
  on public.recruitment_applications (submitted_at desc);

comment on column public.recruitment_applications.submitted_at is 'Public application submission timestamp.';
comment on column public.recruitment_applications.applicant_auth_user_id is 'Optional authenticated Supabase user associated with the applicant.';
