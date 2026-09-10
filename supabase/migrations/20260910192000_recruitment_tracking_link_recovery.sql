do $$
begin
  if not exists (select 1 from vault.secrets where name = 'lscso_recruitment_tracking_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'lscso_recruitment_tracking_key',
      'Encryption key for recoverable recruitment applicant tracking tokens'
    );
  end if;
end
$$;

create table if not exists app_private.recruitment_tracking_tokens (
  application_id uuid primary key references public.recruitment_applications(id) on delete cascade,
  token_ciphertext bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on table app_private.recruitment_tracking_tokens from public, anon, authenticated;

drop function if exists app_private.recruitment_tracking_key();
create function app_private.recruitment_tracking_key()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'lscso_recruitment_tracking_key'
  order by created_at desc
  limit 1
$$;
revoke all on function app_private.recruitment_tracking_key() from public, anon, authenticated;

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
    'Hired In Portal'::text,
    'Applicant Status Message Updated'::text,
    'Applicant Status Message Cleared'::text,
    'Tracking Link Reissued'::text
  ]));

create or replace function public.submit_recruitment_application(
  p_answers jsonb,
  p_signature_name text,
  p_certification_text text,
  p_tracking_token_hash text,
  p_ai_policy_acknowledged boolean,
  p_tracking_token text
)
returns table(id uuid, application_number bigint, applicant_signed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result record;
  v_token text := btrim(coalesce(p_tracking_token, ''));
  v_expected_hash text;
  v_key text;
begin
  if v_token !~ '^[A-Za-z0-9_-]{40,128}$' then
    raise exception 'Applicant tracking token is invalid.';
  end if;

  v_expected_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  if lower(btrim(coalesce(p_tracking_token_hash, ''))) <> v_expected_hash then
    raise exception 'Applicant tracking token is invalid.';
  end if;

  select * into v_result
  from public.submit_recruitment_application(
    p_answers,
    p_signature_name,
    p_certification_text,
    p_tracking_token_hash,
    p_ai_policy_acknowledged
  );

  v_key := app_private.recruitment_tracking_key();
  if coalesce(v_key, '') = '' then
    raise exception 'Applicant tracking token storage is unavailable.';
  end if;

  insert into app_private.recruitment_tracking_tokens(application_id, token_ciphertext)
  values (v_result.id, extensions.pgp_sym_encrypt(v_token, v_key, 'cipher-algo=aes256'))
  on conflict (application_id) do update
    set token_ciphertext = excluded.token_ciphertext,
        updated_at = now();

  return query
  select v_result.id::uuid, v_result.application_number::bigint, v_result.applicant_signed_at::timestamptz;
end;
$$;

revoke execute on function public.submit_recruitment_application(jsonb,text,text,text,boolean) from anon, authenticated;
grant execute on function public.submit_recruitment_application(jsonb,text,text,text,boolean,text) to anon, authenticated;
revoke execute on function public.submit_recruitment_application(jsonb,text,text,text,boolean,text) from public;

create or replace function public.get_recruitment_tracking_token(p_application_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
  v_tier text := app_private.current_access_tier();
  v_ciphertext bytea;
  v_key text;
begin
  if v_actor is null or v_tier not in ('Executive', 'Command') then
    raise exception 'You do not have permission to view applicant tracking links.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.recruitment_applications where id = p_application_id) then
    raise exception 'Unable to load this application.';
  end if;

  select token_ciphertext into v_ciphertext
  from app_private.recruitment_tracking_tokens
  where application_id = p_application_id;

  if v_ciphertext is null then
    return null;
  end if;

  v_key := app_private.recruitment_tracking_key();
  return extensions.pgp_sym_decrypt(v_ciphertext, v_key);
end;
$$;
revoke all on function public.get_recruitment_tracking_token(uuid) from public, anon;
grant execute on function public.get_recruitment_tracking_token(uuid) to authenticated;

create or replace function public.reissue_recruitment_tracking_token(p_application_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
  v_tier text := app_private.current_access_tier();
  v_token text;
  v_hash text;
  v_key text;
begin
  if v_actor is null or v_tier not in ('Executive', 'Command') then
    raise exception 'You do not have permission to reissue applicant tracking links.' using errcode = '42501';
  end if;

  perform 1
  from public.recruitment_applications
  where id = p_application_id
  for update;
  if not found then
    raise exception 'Unable to load this application.';
  end if;

  v_token := replace(replace(replace(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+', '-'), '/', '_'), E'\n', '');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_key := app_private.recruitment_tracking_key();

  update public.recruitment_applications
  set applicant_tracking_token_hash = v_hash,
      applicant_tracking_issued_at = now()
  where id = p_application_id;

  insert into app_private.recruitment_tracking_tokens(application_id, token_ciphertext)
  values (p_application_id, extensions.pgp_sym_encrypt(v_token, v_key, 'cipher-algo=aes256'))
  on conflict (application_id) do update
    set token_ciphertext = excluded.token_ciphertext,
        updated_at = now();

  insert into public.recruitment_application_history(application_id, actor_profile_id, event_type, details)
  values (p_application_id, v_actor, 'Tracking Link Reissued', jsonb_build_object('reissued_at', now()));

  return v_token;
end;
$$;
revoke all on function public.reissue_recruitment_tracking_token(uuid) from public, anon;
grant execute on function public.reissue_recruitment_tracking_token(uuid) to authenticated;
