alter table public.recruitment_applications
  add column if not exists ai_policy_acknowledged boolean not null default false,
  add column if not exists ai_policy_acknowledged_at timestamptz,
  add column if not exists ai_policy_text text;

alter table public.recruitment_applications
  drop constraint if exists recruitment_applications_ai_policy_acknowledgement_check,
  add constraint recruitment_applications_ai_policy_acknowledgement_check
    check (
      ai_policy_acknowledged = false
      or (
        ai_policy_acknowledged_at is not null
        and char_length(trim(coalesce(ai_policy_text, ''))) >= 40
      )
    );

revoke execute on function public.submit_recruitment_application(jsonb, text, text) from anon, authenticated;
revoke execute on function public.submit_recruitment_application(jsonb, text, text, text) from anon, authenticated;

create or replace function public.submit_recruitment_application(
  p_answers jsonb,
  p_signature_name text,
  p_certification_text text,
  p_tracking_token_hash text,
  p_ai_policy_acknowledged boolean
)
returns table(id uuid, application_number bigint, applicant_signed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result record;
  v_policy_text constant text := 'The use of generative artificial intelligence on this application is prohibited. Every substantive response must be written by the applicant without assistance from ChatGPT, Claude, Gemini, Copilot, AI writing, rewriting, paraphrasing, answer-generation, or similar tools. Using AI to draft, rewrite, expand, improve, or generate any application response is forbidden. Any detected use of AI will result in immediate denial of the application.';
begin
  if p_ai_policy_acknowledged is distinct from true then
    raise exception 'You must acknowledge the LSCSO AI Use Policy before continuing with the application.';
  end if;

  select * into v_result
  from public.submit_recruitment_application(
    p_answers,
    p_signature_name,
    p_certification_text,
    p_tracking_token_hash
  );

  update public.recruitment_applications
  set ai_policy_acknowledged = true,
      ai_policy_acknowledged_at = now(),
      ai_policy_text = v_policy_text
  where id = v_result.id;

  return query
  select v_result.id::uuid, v_result.application_number::bigint, v_result.applicant_signed_at::timestamptz;
end;
$$;

revoke all on function public.submit_recruitment_application(jsonb, text, text, text, boolean) from public;
grant execute on function public.submit_recruitment_application(jsonb, text, text, text, boolean) to anon, authenticated, service_role;
