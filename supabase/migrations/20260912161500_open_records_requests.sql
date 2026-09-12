create table if not exists public.open_records_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity unique,
  requester_first_name text not null,
  requester_last_name text not null,
  requester_email text not null,
  requester_phone text,
  requester_organization text,
  subject_name text,
  subject_personnel_id text,
  records_description text not null,
  preferred_delivery text not null default 'Electronic',
  status text not null default 'Submitted' check (status in ('Submitted','Acknowledged','In Review','Awaiting Payment','Ready','Partially Granted','Denied','Completed','Closed')),
  legal_acknowledgement boolean not null default false,
  internal_notes text,
  response_summary text,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists open_records_requests_created_at_idx
  on public.open_records_requests (created_at desc);

create index if not exists open_records_requests_status_idx
  on public.open_records_requests (status, created_at desc);

alter table public.open_records_requests enable row level security;
revoke all on table public.open_records_requests from anon, authenticated;

create or replace function public.submit_open_records_request(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_organization text,
  p_subject_name text,
  p_subject_personnel_id text,
  p_records_description text,
  p_preferred_delivery text,
  p_legal_acknowledgement boolean
)
returns table(request_number bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_number bigint;
  v_first text := trim(coalesce(p_first_name, ''));
  v_last text := trim(coalesce(p_last_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_description text := trim(coalesce(p_records_description, ''));
begin
  if length(v_first) < 1 or length(v_first) > 100 then raise exception 'Please enter a valid first name.'; end if;
  if length(v_last) < 1 or length(v_last) > 100 then raise exception 'Please enter a valid last name.'; end if;
  if length(v_email) < 5 or length(v_email) > 254 or position('@' in v_email) = 0 then raise exception 'Please enter a valid email address.'; end if;
  if length(v_description) < 10 or length(v_description) > 8000 then raise exception 'Please describe the records requested in at least 10 characters and no more than 8,000 characters.'; end if;
  if p_legal_acknowledgement is not true then raise exception 'You must acknowledge the open records notice before submitting.'; end if;
  if coalesce(p_preferred_delivery, 'Electronic') not in ('Electronic','Inspection','Paper Copy') then raise exception 'Select a valid delivery method.'; end if;

  insert into public.open_records_requests (
    requester_first_name,
    requester_last_name,
    requester_email,
    requester_phone,
    requester_organization,
    subject_name,
    subject_personnel_id,
    records_description,
    preferred_delivery,
    legal_acknowledgement
  ) values (
    v_first,
    v_last,
    v_email,
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_organization, '')), ''),
    nullif(trim(coalesce(p_subject_name, '')), ''),
    nullif(upper(trim(coalesce(p_subject_personnel_id, ''))), ''),
    v_description,
    coalesce(p_preferred_delivery, 'Electronic'),
    true
  )
  returning open_records_requests.request_number into v_request_number;

  return query select v_request_number;
end;
$$;

revoke all on function public.submit_open_records_request(text,text,text,text,text,text,text,text,text,boolean) from public;
grant execute on function public.submit_open_records_request(text,text,text,text,text,text,text,text,text,boolean) to anon, authenticated;

create policy "command can read open records requests"
on public.open_records_requests
for select
to authenticated
using (
  exists (
    select 1 from public.personnel_profiles p
    where p.user_id = auth.uid()
      and p.access_tier in ('Executive','Command')
  )
);

create policy "command can update open records requests"
on public.open_records_requests
for update
to authenticated
using (
  exists (
    select 1 from public.personnel_profiles p
    where p.user_id = auth.uid()
      and p.access_tier in ('Executive','Command')
  )
)
with check (
  exists (
    select 1 from public.personnel_profiles p
    where p.user_id = auth.uid()
      and p.access_tier in ('Executive','Command')
  )
);
