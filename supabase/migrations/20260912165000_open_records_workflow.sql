-- Expand the initial Open Records intake into the complete LSCSO request lifecycle.

alter table public.open_records_requests
  add column if not exists tracking_token_hash text,
  add column if not exists requester_discord text,
  add column if not exists response_due_at timestamptz,
  add column if not exists disposition text not null default 'Pending',
  add column if not exists fee_amount numeric(12,2) not null default 0,
  add column if not exists fee_status text not null default 'Not Assessed',
  add column if not exists fee_assessed_at timestamptz,
  add column if not exists fee_assessed_by uuid references public.personnel_profiles(id),
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists payment_confirmed_by uuid references public.personnel_profiles(id),
  add column if not exists payment_reference text,
  add column if not exists withholding_authority text,
  add column if not exists release_available_at timestamptz,
  add column if not exists release_expires_at timestamptz,
  add column if not exists released_by uuid references public.personnel_profiles(id);

update public.open_records_requests
set response_due_at = coalesce(response_due_at, created_at + interval '72 hours')
where response_due_at is null;

alter table public.open_records_requests
  alter column response_due_at set default (now() + interval '72 hours');

create unique index if not exists open_records_requests_tracking_token_hash_unique
  on public.open_records_requests (tracking_token_hash)
  where tracking_token_hash is not null;

create index if not exists open_records_requests_response_due_idx
  on public.open_records_requests (response_due_at)
  where completed_at is null;

alter table public.open_records_requests drop constraint if exists open_records_requests_status_check;
alter table public.open_records_requests add constraint open_records_requests_status_check
  check (status in (
    'Submitted',
    'Under Initial Review',
    'Fee Assessed',
    'Awaiting Payment',
    'Paid',
    'Records Collection',
    'Redaction & Legal Review',
    'Ready for Release',
    'Released',
    'Denied',
    'Expired',
    'Closed'
  ));

alter table public.open_records_requests drop constraint if exists open_records_requests_disposition_check;
alter table public.open_records_requests add constraint open_records_requests_disposition_check
  check (disposition in ('Pending','Granted','Partially Granted','Denied'));

alter table public.open_records_requests drop constraint if exists open_records_requests_fee_amount_check;
alter table public.open_records_requests add constraint open_records_requests_fee_amount_check
  check (fee_amount >= 0);

alter table public.open_records_requests drop constraint if exists open_records_requests_fee_status_check;
alter table public.open_records_requests add constraint open_records_requests_fee_status_check
  check (fee_status in ('Not Assessed','Awaiting Payment','Paid','Waived'));

create table if not exists public.open_records_request_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.open_records_requests(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  uploaded_by uuid references public.personnel_profiles(id),
  uploaded_at timestamptz not null default now(),
  released_at timestamptz,
  download_url text,
  deleted_at timestamptz
);

create index if not exists open_records_request_files_request_idx
  on public.open_records_request_files (request_id, uploaded_at asc);

create table if not exists public.open_records_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.open_records_requests(id) on delete cascade,
  event_type text not null,
  actor_profile_id uuid references public.personnel_profiles(id),
  public_message text,
  internal_detail text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists open_records_request_events_request_idx
  on public.open_records_request_events (request_id, created_at asc);

create table if not exists public.open_records_purge_config (
  id boolean primary key default true check (id),
  secret text not null
);

insert into public.open_records_purge_config (id, secret)
values (true, encode(gen_random_bytes(32), 'hex'))
on conflict (id) do nothing;

revoke all on table public.open_records_purge_config from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'open-records-release',
  'open-records-release',
  false,
  26214400,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_open_records_custodian()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.personnel_profiles p
    where p.auth_user_id = auth.uid()
      and p.status <> 'Deactivated'
      and p.rank in ('Sheriff','Undersheriff','Major','Captain','1st Lieutenant')
  );
$$;

revoke all on function public.is_open_records_custodian() from public;
grant execute on function public.is_open_records_custodian() to authenticated;

alter table public.open_records_requests enable row level security;
alter table public.open_records_request_files enable row level security;
alter table public.open_records_request_events enable row level security;

revoke all on table public.open_records_requests from anon, authenticated;
grant select on table public.open_records_requests to authenticated;
grant update (
  status,
  disposition,
  fee_amount,
  fee_status,
  fee_assessed_at,
  fee_assessed_by,
  payment_confirmed_at,
  payment_confirmed_by,
  payment_reference,
  acknowledged_at,
  response_summary,
  withholding_authority,
  internal_notes,
  release_available_at,
  release_expires_at,
  released_by,
  completed_at,
  updated_at
) on table public.open_records_requests to authenticated;

revoke all on table public.open_records_request_files from anon, authenticated;
grant select, insert, update, delete on table public.open_records_request_files to authenticated;

revoke all on table public.open_records_request_events from anon, authenticated;
grant select, insert on table public.open_records_request_events to authenticated;

drop policy if exists "command can read open records requests" on public.open_records_requests;
drop policy if exists "command can update open records requests" on public.open_records_requests;
drop policy if exists "open records custodians can read requests" on public.open_records_requests;
drop policy if exists "open records custodians can update requests" on public.open_records_requests;

create policy "open records custodians can read requests"
on public.open_records_requests for select to authenticated
using (public.is_open_records_custodian());

create policy "open records custodians can update requests"
on public.open_records_requests for update to authenticated
using (public.is_open_records_custodian())
with check (public.is_open_records_custodian());

drop policy if exists "open records custodians can read files" on public.open_records_request_files;
drop policy if exists "open records custodians can insert files" on public.open_records_request_files;
drop policy if exists "open records custodians can update files" on public.open_records_request_files;
drop policy if exists "open records custodians can delete files" on public.open_records_request_files;

create policy "open records custodians can read files"
on public.open_records_request_files for select to authenticated
using (public.is_open_records_custodian());

create policy "open records custodians can insert files"
on public.open_records_request_files for insert to authenticated
with check (public.is_open_records_custodian());

create policy "open records custodians can update files"
on public.open_records_request_files for update to authenticated
using (public.is_open_records_custodian())
with check (public.is_open_records_custodian());

create policy "open records custodians can delete files"
on public.open_records_request_files for delete to authenticated
using (public.is_open_records_custodian());

drop policy if exists "open records custodians can read events" on public.open_records_request_events;
drop policy if exists "open records custodians can insert events" on public.open_records_request_events;

create policy "open records custodians can read events"
on public.open_records_request_events for select to authenticated
using (public.is_open_records_custodian());

create policy "open records custodians can insert events"
on public.open_records_request_events for insert to authenticated
with check (public.is_open_records_custodian());

drop policy if exists "open records custodians can read storage" on storage.objects;
drop policy if exists "open records custodians can upload storage" on storage.objects;
drop policy if exists "open records custodians can update storage" on storage.objects;
drop policy if exists "open records custodians can delete storage" on storage.objects;

create policy "open records custodians can read storage"
on storage.objects for select to authenticated
using (bucket_id = 'open-records-release' and public.is_open_records_custodian());

create policy "open records custodians can upload storage"
on storage.objects for insert to authenticated
with check (bucket_id = 'open-records-release' and public.is_open_records_custodian());

create policy "open records custodians can update storage"
on storage.objects for update to authenticated
using (bucket_id = 'open-records-release' and public.is_open_records_custodian())
with check (bucket_id = 'open-records-release' and public.is_open_records_custodian());

create policy "open records custodians can delete storage"
on storage.objects for delete to authenticated
using (bucket_id = 'open-records-release' and public.is_open_records_custodian());

-- Replace the original public-submission RPC so every request requires Discord
-- and receives a private tracking token hash.
drop function if exists public.submit_open_records_request(text,text,text,text,text,text,text,text,text,boolean);

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
  p_legal_acknowledgement boolean,
  p_tracking_token_hash text
)
returns table(request_number bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_request_number bigint;
  v_first text := trim(coalesce(p_first_name, ''));
  v_last text := trim(coalesce(p_last_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_discord text := trim(coalesce(p_discord_username, ''));
  v_description text := trim(coalesce(p_records_description, ''));
  v_tracking_hash text := lower(trim(coalesce(p_tracking_token_hash, '')));
begin
  if length(v_first) < 1 or length(v_first) > 100 then raise exception 'Please enter a valid first name.'; end if;
  if length(v_last) < 1 or length(v_last) > 100 then raise exception 'Please enter a valid last name.'; end if;
  if length(v_email) < 5 or length(v_email) > 254 or position('@' in v_email) = 0 then raise exception 'Please enter a valid email address.'; end if;
  if length(v_discord) < 2 or length(v_discord) > 100 then raise exception 'Please enter your Discord username.'; end if;
  if length(v_description) < 10 or length(v_description) > 8000 then raise exception 'Please describe the records requested in at least 10 characters and no more than 8,000 characters.'; end if;
  if p_legal_acknowledgement is not true then raise exception 'You must acknowledge the open records notice before submitting.'; end if;
  if coalesce(p_preferred_delivery, 'Electronic') <> 'Electronic' then raise exception 'Open records releases are delivered electronically through the private request link.'; end if;
  if v_tracking_hash !~ '^[0-9a-f]{64}$' then raise exception 'Tracking token is invalid.'; end if;

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

  return query select v_request_number;
end;
$$;

revoke all on function public.submit_open_records_request(text,text,text,text,text,text,text,text,text,text,boolean,text) from public;
grant execute on function public.submit_open_records_request(text,text,text,text,text,text,text,text,text,text,boolean,text) to anon, authenticated;

create or replace function public.get_open_records_request_status(p_tracking_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'request_number', r.request_number,
    'requester_name', r.requester_first_name || ' ' || r.requester_last_name,
    'requester_discord', r.requester_discord,
    'subject_name', r.subject_name,
    'subject_personnel_id', r.subject_personnel_id,
    'records_description', r.records_description,
    'status', r.status,
    'disposition', r.disposition,
    'created_at', r.created_at,
    'response_due_at', r.response_due_at,
    'acknowledged_at', r.acknowledged_at,
    'fee_amount', r.fee_amount,
    'fee_status', r.fee_status,
    'response_summary', r.response_summary,
    'withholding_authority', r.withholding_authority,
    'release_available_at', r.release_available_at,
    'release_expires_at', r.release_expires_at,
    'completed_at', r.completed_at,
    'files', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', f.id,
          'file_name', f.file_name,
          'mime_type', f.mime_type,
          'size_bytes', f.size_bytes,
          'released_at', f.released_at,
          'download_url', case
            when f.deleted_at is null
              and r.release_expires_at is not null
              and now() < r.release_expires_at
            then f.download_url
            else null
          end,
          'deleted_at', f.deleted_at
        ) order by f.uploaded_at asc
      )
      from public.open_records_request_files f
      where f.request_id = r.id
        and f.released_at is not null
    ), '[]'::jsonb)
  )
  from public.open_records_requests r
  where r.tracking_token_hash = lower(trim(p_tracking_token_hash))
  limit 1;
$$;

revoke all on function public.get_open_records_request_status(text) from public;
grant execute on function public.get_open_records_request_status(text) to anon, authenticated;
