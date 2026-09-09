create table if not exists public.recruitment_applicant_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruitment_applications(id) on delete cascade,
  author_profile_id uuid references public.personnel_profiles(id) on delete set null,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists recruitment_applicant_messages_application_created_idx
  on public.recruitment_applicant_messages(application_id, created_at);

alter table public.recruitment_applicant_messages enable row level security;

drop policy if exists recruitment_applicant_messages_command_select on public.recruitment_applicant_messages;
create policy recruitment_applicant_messages_command_select
  on public.recruitment_applicant_messages
  for select
  to authenticated
  using ((select app_private.current_access_tier()) = any (array['Executive'::text, 'Command'::text]));

drop policy if exists recruitment_applicant_messages_command_insert on public.recruitment_applicant_messages;
create policy recruitment_applicant_messages_command_insert
  on public.recruitment_applicant_messages
  for insert
  to authenticated
  with check (
    (select app_private.current_access_tier()) = any (array['Executive'::text, 'Command'::text])
    and author_profile_id = (select app_private.current_profile_id())
  );

insert into public.recruitment_applicant_messages(application_id, author_profile_id, content, created_at)
select
  a.id,
  a.applicant_status_message_updated_by_profile_id,
  btrim(a.applicant_status_message),
  coalesce(a.applicant_status_message_updated_at, a.updated_at, a.submitted_at, now())
from public.recruitment_applications a
where nullif(btrim(a.applicant_status_message), '') is not null
  and not exists (
    select 1
    from public.recruitment_applicant_messages m
    where m.application_id = a.id
      and m.content = btrim(a.applicant_status_message)
      and abs(extract(epoch from (m.created_at - coalesce(a.applicant_status_message_updated_at, a.updated_at, a.submitted_at, now())))) < 2
  );

create or replace function public.send_recruitment_applicant_message(p_application_id uuid, p_content text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_content text := btrim(coalesce(p_content, ''));
  v_message_id uuid;
begin
  if (select app_private.current_access_tier()) <> all (array['Executive'::text, 'Command'::text]) then
    raise exception 'You do not have permission to send applicant messages.';
  end if;

  v_profile_id := (select app_private.current_profile_id());
  if v_profile_id is null then
    raise exception 'Unable to identify the current personnel profile.';
  end if;

  if char_length(v_content) < 1 then
    raise exception 'Enter a message before sending.';
  end if;
  if char_length(v_content) > 2000 then
    raise exception 'Applicant messages may not exceed 2,000 characters.';
  end if;

  if not exists (select 1 from public.recruitment_applications a where a.id = p_application_id) then
    raise exception 'Unable to load this application.';
  end if;

  insert into public.recruitment_applicant_messages(application_id, author_profile_id, content)
  values (p_application_id, v_profile_id, v_content)
  returning id into v_message_id;

  update public.recruitment_applications
  set applicant_status_message = v_content,
      applicant_status_message_updated_at = now(),
      applicant_status_message_updated_by_profile_id = v_profile_id
  where id = p_application_id;

  insert into public.recruitment_application_history(application_id, actor_profile_id, event_type, details)
  values (
    p_application_id,
    v_profile_id,
    'Applicant Status Message Updated',
    jsonb_build_object('message_id', v_message_id, 'preview', left(v_content, 180))
  );

  return v_message_id;
end;
$$;

revoke all on function public.send_recruitment_applicant_message(uuid, text) from public, anon;
grant execute on function public.send_recruitment_applicant_message(uuid, text) to authenticated, service_role;

create or replace function public.get_recruitment_application_messages(p_tracking_token_hash text)
returns table(id uuid, content text, sent_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select m.id, m.content, m.created_at as sent_at
  from public.recruitment_applicant_messages m
  join public.recruitment_applications a on a.id = m.application_id
  where p_tracking_token_hash ~ '^[a-f0-9]{64}$'
    and a.applicant_tracking_token_hash = p_tracking_token_hash
  order by m.created_at asc;
$$;

revoke all on function public.get_recruitment_application_messages(text) from public;
grant execute on function public.get_recruitment_application_messages(text) to anon, authenticated, service_role;
