alter table public.recruitment_applications
  add column if not exists applicant_signature_name text,
  add column if not exists applicant_signed_at timestamptz,
  add column if not exists applicant_signature_method text,
  add column if not exists applicant_certification_text text;

alter table public.recruitment_applications
  add constraint recruitment_applications_signature_name_check
    check (applicant_signature_name is null or char_length(trim(applicant_signature_name)) between 2 and 120),
  add constraint recruitment_applications_signature_method_check
    check (applicant_signature_method is null or applicant_signature_method = 'Click to sign');

comment on column public.recruitment_applications.applicant_signature_name is 'Applicant name captured when the application is electronically signed.';
comment on column public.recruitment_applications.applicant_signed_at is 'Server-recorded time the applicant electronically signed the application.';
comment on column public.recruitment_applications.applicant_signature_method is 'Electronic signature method used by the applicant. IP addresses are not collected.';
comment on column public.recruitment_applications.applicant_certification_text is 'Exact certification language acknowledged by the applicant at signing.';
