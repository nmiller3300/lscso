drop function if exists public.submit_open_records_request(text,text,text,text,text,text,text,text,text,text,boolean,text);

create or replace function public.submit_open_records_request(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_discord_username text,
  p_phone text,
  p_organization text,
  p_subject_name text,
  p_subject_personnel_id text,
  p_records_description text,
  p_preferred_delivery text,
  p_legal_acknowledgement boolean
)
returns table(request_number bigint, tracking_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_request_number bigint;
  v_tracking_token text := encode(gen_random_bytes(32), 'hex');
  v_tracking_hash text := encode(digest(v_tracking_token, 'sha256'), 'hex');
  v_first text := trim(coalesce(p_first_name, ''));
  v_last text := trim(coalesce(p_last_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_discord text := trim(coalesce(p_discord_username, ''));
  v_description text := trim(coalesce(p_records_description, ''));
begin
  if length(v_first) < 1 or length(v_first) > 100 then raise exception 'Please enter a valid first name.'; end if;
  if length(v_last) < 1 or length(v_last) > 100 then raise exception 'Please enter a valid last name.'; end if;
  if length(v_email) < 5 or length(v_email) > 254 or position('@' in v_email) = 0 then raise exception 'Please enter a valid email address.'; end if;
  if length(v_discord) < 2 or length(v_discord) > 100 then raise exception 'Please enter your Discord username.'; end if;
  if length(v_description) < 10 or length(v_description) > 8000 then raise exception 'Please describe the records requested in at least 10 characters and no more than 8,000 characters.'; end if;
  if p_legal_acknowledgement is not true then raise exception 'You must acknowledge the open records notice before submitting.'; end if;
  if coalesce(p_preferred_delivery, 'Electronic') <> 'Electronic' then raise exception 'Open records releases are delivered electronically through the private request link.'; end if;

  insert into public.open_records_requests (
    tracking_token_hash,
    requester_first_name,
    requester_last_name,
    requester_email,
    requester_discord,
    requester_phone,
    requester_organization,
    subject_name,
    subject_personnel_id,
    records_description,
    preferred_delivery,
    legal_acknowledgement,
    response_due_at
  ) values (
    v_tracking_hash,
    v_first,
    v_last,
    v_email,
    v_discord,
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_organization, '')), ''),
    nullif(trim(coalesce(p_subject_name, '')), ''),
    nullif(upper(trim(coalesce(p_subject_personnel_id, ''))), ''),
    v_description,
    'Electronic',
    true,
    now() + interval '72 hours'
  )
  returning id, open_records_requests.request_number into v_request_id, v_request_number;

  insert into public.open_records_request_events (
    request_id,
    event_type,
    public_message,
    internal_detail
  ) values (
    v_request_id,
    'Submitted',
    'Open Records Request submitted to LSCSO.',
    'Public intake created. Initial custodian determination due within 72 hours under OCSA § 50-18-71.2.'
  );

  return query select v_request_number, v_tracking_token;
end;
$$;

revoke all on function public.submit_open_records_request(text,text,text,text,text,text,text,text,text,text,boolean) from public;
grant execute on function public.submit_open_records_request(text,text,text,text,text,text,text,text,text,text,boolean) to anon, authenticated;
