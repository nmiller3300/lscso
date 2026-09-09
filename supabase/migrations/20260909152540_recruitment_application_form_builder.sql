create table if not exists public.recruitment_application_questions (
  id uuid primary key default gen_random_uuid(),
  question_key text not null unique,
  section_title text not null,
  section_short_title text not null,
  section_eyebrow text not null,
  section_description text not null,
  prompt text not null,
  question_type text not null check (question_type in ('short_text', 'long_text', 'multiple_choice', 'yes_no')),
  help_text text,
  placeholder text,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  required boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  system_field text,
  locked boolean not null default false,
  created_by_profile_id uuid references public.personnel_profiles(id),
  updated_by_profile_id uuid references public.personnel_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recruitment_application_questions_key_format check (question_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint recruitment_application_questions_prompt_length check (char_length(btrim(prompt)) between 3 and 1200),
  constraint recruitment_application_questions_section_length check (char_length(btrim(section_title)) between 2 and 120),
  constraint recruitment_application_questions_multiple_choice_options check (question_type <> 'multiple_choice' or jsonb_array_length(options) >= 2)
);

alter table public.recruitment_application_questions enable row level security;
revoke all on public.recruitment_application_questions from public, anon, authenticated;
grant all on public.recruitment_application_questions to service_role;

alter table public.recruitment_applications
  add column if not exists application_answers jsonb not null default '{}'::jsonb,
  add column if not exists application_question_snapshot jsonb not null default '[]'::jsonb;

alter table public.recruitment_applications alter column age drop not null;
alter table public.recruitment_applications alter column timezone drop not null;
alter table public.recruitment_applications alter column fivem_experience drop not null;
alter table public.recruitment_applications alter column weekly_hours drop not null;
alter table public.recruitment_applications alter column upcoming_commitments drop not null;
alter table public.recruitment_applications alter column previous_departments drop not null;
alter table public.recruitment_applications alter column serious_roleplay_definition drop not null;
alter table public.recruitment_applications alter column why_lscso drop not null;
alter table public.recruitment_applications alter column contribution drop not null;
alter table public.recruitment_applications alter column reasonable_suspicion_probable_cause drop not null;
alter table public.recruitment_applications alter column use_of_force_factors drop not null;
alter table public.recruitment_applications alter column scenario_speeding_nervous drop not null;
alter table public.recruitment_applications alter column scenario_deputy_policy_violation drop not null;
alter table public.recruitment_applications alter column scenario_supervisor_order drop not null;

insert into public.recruitment_application_questions
  (question_key, section_title, section_short_title, section_eyebrow, section_description, prompt, question_type, help_text, placeholder, options, required, active, sort_order, system_field, locked)
values
  ('full_name','Applicant Information','Identity','Candidate Record','Start with the information Command will use to identify you and contact you during the selection process.','What is your full name?','short_text',null,'First and last name','[]'::jsonb,true,true,10,'full_name',true),
  ('discord_username','Applicant Information','Identity','Candidate Record','Start with the information Command will use to identify you and contact you during the selection process.','What is your Discord username?','short_text',null,'Your Discord username','[]'::jsonb,true,true,20,'discord_username',true),
  ('age','Applicant Information','Identity','Candidate Record','Start with the information Command will use to identify you and contact you during the selection process.','What is your age?','short_text',null,'Age','[]'::jsonb,true,true,30,'age',false),
  ('timezone','Applicant Information','Identity','Candidate Record','Start with the information Command will use to identify you and contact you during the selection process.','What is your timezone?','short_text',null,'Example: EST / America/New_York','[]'::jsonb,true,true,40,'timezone',false),
  ('fivem_experience','Experience & Availability','Experience','Service Readiness','Give Command a clear picture of your roleplay background, prior department experience, and realistic availability.','How long have you been playing FiveM and participating in serious roleplay?','long_text','Tell us about the kind of communities, roles, and scenarios you have experience with.','Describe your FiveM and serious roleplay experience…','[]'::jsonb,true,true,50,'fivem_experience',false),
  ('previous_departments','Experience & Availability','Experience','Service Readiness','Give Command a clear picture of your roleplay background, prior department experience, and realistic availability.','What departments or factions have you previously been a member of?','long_text','Include the community, department, approximate rank, and why you left when relevant.','List prior departments or factions, or enter None…','[]'::jsonb,true,true,60,'previous_departments',false),
  ('weekly_hours','Experience & Availability','Experience','Service Readiness','Give Command a clear picture of your roleplay background, prior department experience, and realistic availability.','How many hours per week can you dedicate to LSCSO?','short_text',null,'Example: 8–12 hours','[]'::jsonb,true,true,70,'weekly_hours',false),
  ('upcoming_commitments','Experience & Availability','Experience','Service Readiness','Give Command a clear picture of your roleplay background, prior department experience, and realistic availability.','Do you have any upcoming commitments that may affect your activity?','long_text','School, work, travel, or other known commitments are fine — accuracy matters more than a perfect schedule.','Explain any upcoming commitments, or enter None…','[]'::jsonb,true,true,80,'upcoming_commitments',false),
  ('why_lscso','Why LSCSO?','Motivation','Department Fit','This is where we want to hear your reasoning, not a canned law-enforcement answer. Tell us why this department fits you.','Why do you want to join the Los Santos County Sheriff''s Office?','long_text','Be specific about LSCSO, the type of roleplay you want, and what you hope to learn.','Tell Command why LSCSO is the department you want to serve with…','[]'::jsonb,true,true,90,'why_lscso',false),
  ('contribution','Why LSCSO?','Motivation','Department Fit','This is where we want to hear your reasoning, not a canned law-enforcement answer. Tell us why this department fits you.','What do you believe you can contribute to LSCSO?','long_text','Think beyond rank. Reliability, judgment, roleplay quality, teamwork, and initiative all matter.','Describe what you would bring to the department…','[]'::jsonb,true,true,100,'contribution',false),
  ('drug_use_history','Background & Integrity','Integrity','Suitability Review','Answer this section completely and honestly. Command uses it as part of the applicant suitability review.','Have you ever used illegal drugs, used prescription medication not prescribed to you, or otherwise misused a controlled substance? If yes, identify the substance(s), approximate date(s), frequency, and any relevant context. If no, enter No.','long_text','Do not omit information because you think it will automatically disqualify you. Accuracy and integrity are being evaluated.','Provide a complete answer…','[]'::jsonb,true,true,110,'drug_use_history',false),
  ('serious_roleplay_definition','Roleplay & Law Enforcement','LE Knowledge','Foundational Judgment','You do not need to write a textbook. We are looking for a working understanding of serious roleplay and basic law-enforcement decision making.','What does serious roleplay mean to you?','long_text','Explain how you approach character decisions, consequences, realism, and collaborative scenes.','Describe your standard for serious roleplay…','[]'::jsonb,true,true,120,'serious_roleplay_definition',false),
  ('reasonable_suspicion_probable_cause','Roleplay & Law Enforcement','LE Knowledge','Foundational Judgment','You do not need to write a textbook. We are looking for a working understanding of serious roleplay and basic law-enforcement decision making.','Explain the difference between reasonable suspicion and probable cause.','long_text','Use your own words. We are looking for your understanding, not copied legal language.','Explain the distinction and how each affects an officer''s actions…','[]'::jsonb,true,true,130,'reasonable_suspicion_probable_cause',false),
  ('use_of_force_factors','Roleplay & Law Enforcement','LE Knowledge','Foundational Judgment','You do not need to write a textbook. We are looking for a working understanding of serious roleplay and basic law-enforcement decision making.','What factors should an officer consider before using force?','long_text','Think about threat, resistance, proportionality, available options, and the totality of the circumstances.','Walk through the factors you would evaluate…','[]'::jsonb,true,true,140,'use_of_force_factors',false),
  ('scenario_speeding_nervous','Scenarios','Scenarios','Field Judgment','Treat each prompt like a live roleplay situation. Explain what you would notice, what you would do, and why.','You stop a vehicle for speeding. The driver becomes increasingly nervous during the stop. What do you do?','long_text','Show how you balance officer safety, lawful authority, observation, and escalation decisions.','Talk Command through your actions from the stop forward…','[]'::jsonb,true,true,150,'scenario_speeding_nervous',false),
  ('scenario_deputy_policy_violation','Scenarios','Scenarios','Field Judgment','Treat each prompt like a live roleplay situation. Explain what you would notice, what you would do, and why.','You witness another deputy violating department policy. What do you do?','long_text','Consider immediate safety, professionalism, documentation, and the chain of command.','Explain how you would handle the violation…','[]'::jsonb,true,true,160,'scenario_deputy_policy_violation',false),
  ('scenario_supervisor_order','Scenarios','Scenarios','Field Judgment','Treat each prompt like a live roleplay situation. Explain what you would notice, what you would do, and why.','A supervisor orders you to do something you believe violates department policy. How do you handle it?','long_text','Explain how you would clarify the order, protect the scene, and address the policy concern appropriately.','Explain your decision-making and communication…','[]'::jsonb,true,true,170,'scenario_supervisor_order',false)
on conflict (question_key) do nothing;
