create or replace function public.get_recruitment_application_status(p_tracking_token_hash text)
returns table(
  application_number bigint,
  applicant_name text,
  status text,
  interview_status text,
  submitted_at timestamptz,
  updated_at timestamptz,
  interview_scheduled_at timestamptz,
  applicant_status_message text,
  hired boolean,
  closure_code text,
  closure_reason text,
  offer_id uuid,
  offer_status text,
  offer_title text,
  offer_terms text,
  offer_rank text,
  offer_issued_at timestamptz,
  offer_expires_at timestamptz,
  offer_accepted_at timestamptz,
  offer_signature_name text
)
language sql
security definer
set search_path = ''
as $$
  select
    a.application_number,
    a.full_name,
    a.status,
    a.interview_status,
    a.submitted_at,
    greatest(a.updated_at,coalesce(a.applicant_status_message_updated_at,a.updated_at),coalesce(o.updated_at,a.updated_at)),
    a.interview_scheduled_at,
    a.applicant_status_message,
    (a.status='Hired' or a.hired_profile_id is not null),
    coalesce(
      a.recruitment_closure_code,
      case
        when a.status='Denied' then 'Application Denied'
        when a.status='Accepted' and a.interview_status='Failed' then 'Interview Failed'
        when a.status='Withdrawn' then 'Application Withdrawn'
        else null
      end
    ),
    coalesce(
      nullif(btrim(a.recruitment_closure_reason),''),
      case
        when a.status='Denied' then nullif(btrim(a.decision_notes),'')
        when a.status='Accepted' and a.interview_status='Failed' then nullif(btrim(a.interview_result),'')
        else null
      end
    ),
    o.id,
    case when o.status='Pending' and o.expires_at is not null and o.expires_at <= now() then 'Expired' else o.status end,
    o.title,
    o.terms,
    o.offered_rank,
    o.issued_at,
    o.expires_at,
    o.accepted_at,
    o.accepted_signature_name
  from public.recruitment_applications a
  left join lateral (
    select eo.* from public.recruitment_employment_offers eo
    where eo.application_id=a.id
    order by eo.issued_at desc
    limit 1
  ) o on true
  where p_tracking_token_hash ~ '^[a-f0-9]{64}$'
    and a.applicant_tracking_token_hash=p_tracking_token_hash
    and (a.applicant_tracking_expires_at is null or a.applicant_tracking_expires_at > now())
  limit 1
$$;

revoke all on function public.get_recruitment_application_status(text) from public;
grant execute on function public.get_recruitment_application_status(text) to anon, authenticated, service_role;
