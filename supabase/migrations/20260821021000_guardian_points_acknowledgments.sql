alter table public.guardian_records
  add column points_assessed smallint not null default 0,
  add column escalation_override boolean not null default false,
  add column escalation_reason text;

alter table public.guardian_records
  add constraint guardian_records_points_range
    check (points_assessed between 0 and 10),
  add constraint guardian_records_commendation_points
    check (record_type <> 'Commendation' or points_assessed = 0),
  add constraint guardian_records_escalation_reason
    check (not escalation_override or nullif(trim(escalation_reason), '') is not null);

create table public.disciplinary_point_tiers (
  id smallint primary key,
  min_points smallint not null,
  max_points smallint not null,
  tier_name text not null unique,
  standing_label text not null,
  action_required text not null,
  color_key text not null,
  sort_order smallint not null unique,
  check (min_points between 0 and 10),
  check (max_points between min_points and 10),
  check (color_key in ('green','yellow','orange','red','critical'))
);

insert into public.disciplinary_point_tiers
  (id, min_points, max_points, tier_name, standing_label, action_required, color_key, sort_order)
values
  (0, 0, 0, 'Good Standing', 'Good Standing', 'No action — member is in full compliance.', 'green', 0),
  (1, 1, 2, 'Level One', 'Level One', 'Verbal warning and documented counseling session with direct supervisor.', 'yellow', 1),
  (2, 3, 4, 'Level Two', 'Level Two', 'Written Warning issued to personnel file; performance improvement plan initiated.', 'orange', 2),
  (3, 5, 6, 'Level Three', 'Level Three', 'Final Written Warning, mandatory remedial training, and possible temporary reassignment.', 'red', 3),
  (4, 7, 8, 'Level Four', 'Level Four', 'Mandatory suspension; length determined by severity, with command review of continued employment.', 'critical', 4),
  (5, 9, 9, 'Level Five', 'Level Five', 'Extended suspension pending final command review; termination likely.', 'critical', 5),
  (6, 10, 10, 'Termination', 'Termination', 'Permanent removal from duty; badge and credentials revoked.', 'critical', 6);

create table public.guardian_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null unique references public.guardian_records(id) on delete restrict,
  profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  fingerprint_id text not null unique,
  typed_name text,
  signature_method text not null,
  acknowledgment_text text not null,
  personnel_id_snapshot text not null,
  display_name_snapshot text not null,
  rank_snapshot text not null,
  call_sign_snapshot text,
  response_text text,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (signature_method in ('Typed name','Receipt acknowledgment')),
  check (
    (signature_method = 'Typed name' and nullif(trim(typed_name), '') is not null)
    or (signature_method = 'Receipt acknowledgment' and typed_name is null)
  )
);

create index guardian_acknowledgments_profile_idx
  on public.guardian_acknowledgments (profile_id, signed_at desc);

alter table public.disciplinary_point_tiers enable row level security;
alter table public.guardian_acknowledgments enable row level security;

create policy disciplinary_point_tiers_select
on public.disciplinary_point_tiers
for select to authenticated
using (true);

create policy guardian_acknowledgments_select
on public.guardian_acknowledgments
for select to authenticated
using (
  profile_id = (select app_private.current_profile_id())
  or (select app_private.current_access_tier()) in ('Executive','Command')
  or exists (
    select 1
    from public.guardian_records guardian
    where guardian.id = guardian_id
      and guardian.author_profile_id = (select app_private.current_profile_id())
  )
);

revoke all on public.disciplinary_point_tiers from anon;
revoke all on public.guardian_acknowledgments from anon;
grant select on public.disciplinary_point_tiers to authenticated;
grant select on public.guardian_acknowledgments to authenticated;

revoke all on function public.acknowledge_guardian(uuid, text) from public, anon, authenticated;
drop function public.acknowledge_guardian(uuid, text);

create function public.acknowledge_guardian(
  record_id uuid,
  signature_name text,
  response_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile public.personnel_profiles;
  guardian public.guardian_records;
  fingerprint text;
  signed_time timestamptz := now();
  is_negative boolean;
begin
  select * into current_profile
  from public.personnel_profiles
  where id = app_private.current_profile_id();

  if current_profile.id is null then
    raise exception 'Authorized profile required';
  end if;

  select * into guardian
  from public.guardian_records
  where id = record_id
    and subject_profile_id = current_profile.id
    and status in ('Issued','Awaiting Acknowledgment')
  for update;

  if guardian.id is null then
    raise exception 'Guardian record is unavailable for acknowledgment';
  end if;

  is_negative := guardian.record_type <> 'Commendation';
  if is_negative and char_length(trim(coalesce(signature_name, ''))) < 2 then
    raise exception 'Type your name to sign and acknowledge this Guardian';
  end if;

  fingerprint := 'GF-' || to_char(signed_time at time zone 'UTC', 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));

  insert into public.guardian_acknowledgments (
    guardian_id,
    profile_id,
    fingerprint_id,
    typed_name,
    signature_method,
    acknowledgment_text,
    personnel_id_snapshot,
    display_name_snapshot,
    rank_snapshot,
    call_sign_snapshot,
    response_text,
    signed_at
  ) values (
    guardian.id,
    current_profile.id,
    fingerprint,
    case when is_negative then trim(signature_name) else null end,
    case when is_negative then 'Typed name' else 'Receipt acknowledgment' end,
    case
      when is_negative then 'I acknowledge receipt of this Guardian. My acknowledgment confirms receipt only and does not indicate agreement. This is an internal department acknowledgment and is not a legal signature.'
      else 'I acknowledge receipt of this commendation.'
    end,
    current_profile.personnel_id,
    current_profile.display_name,
    current_profile.rank,
    current_profile.call_sign,
    nullif(trim(response_text), ''),
    signed_time
  );

  update public.guardian_records
  set
    status = 'Acknowledged',
    acknowledged_at = signed_time,
    employee_response = nullif(trim(response_text), ''),
    updated_at = signed_time
  where id = guardian.id;

  return jsonb_build_object(
    'guardian_id', guardian.id,
    'guardian_number', guardian.guardian_number,
    'fingerprint_id', fingerprint,
    'acknowledged_at', signed_time,
    'status', 'Acknowledged'
  );
end;
$$;

revoke all on function public.acknowledge_guardian(uuid, text, text) from public, anon;
grant execute on function public.acknowledge_guardian(uuid, text, text) to authenticated;

create function public.review_guardian(
  record_id uuid,
  decision text,
  review_notes text default null
)
returns public.guardian_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile uuid := app_private.current_profile_id();
  current_tier text := app_private.current_access_tier();
  updated_record public.guardian_records;
begin
  if current_profile is null or current_tier not in ('Executive','Command') then
    raise exception 'Command approval authority required';
  end if;

  if decision not in ('Approved','Denied') then
    raise exception 'Decision must be Approved or Denied';
  end if;

  update public.guardian_records
  set
    status = decision,
    approved_by = current_profile,
    approved_at = case when decision = 'Approved' then now() else null end,
    command_notes = nullif(trim(review_notes), ''),
    updated_at = now()
  where id = record_id
    and status = 'Pending Approval'
  returning * into updated_record;

  if updated_record.id is null then
    raise exception 'Guardian is unavailable for command review';
  end if;

  return updated_record;
end;
$$;

revoke all on function public.review_guardian(uuid, text, text) from public, anon;
grant execute on function public.review_guardian(uuid, text, text) to authenticated;

create function public.issue_guardian(record_id uuid)
returns public.guardian_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile uuid := app_private.current_profile_id();
  updated_record public.guardian_records;
begin
  if current_profile is null then
    raise exception 'Authorized profile required';
  end if;

  update public.guardian_records
  set
    status = 'Awaiting Acknowledgment',
    issued_at = now(),
    updated_at = now()
  where id = record_id
    and author_profile_id = current_profile
    and status = 'Approved'
  returning * into updated_record;

  if updated_record.id is null then
    raise exception 'Only the author may issue an approved Guardian';
  end if;

  return updated_record;
end;
$$;

revoke all on function public.issue_guardian(uuid) from public, anon;
grant execute on function public.issue_guardian(uuid) to authenticated;

create function app_private.notify_guardian_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'Pending Approval' then
    insert into public.notifications (recipient_profile_id, notification_type, title, message, href)
    select
      profile.id,
      'Guardian Approval',
      'Guardian awaiting command review',
      'G-' || lpad(new.guardian_number::text, 4, '0') || ' requires a command decision.',
      '/portal/command/guardians'
    from public.personnel_profiles profile
    where profile.access_tier in ('Executive','Command')
      and profile.status in ('Active','Acting')
      and profile.id <> new.author_profile_id;
  end if;

  if (tg_op = 'INSERT' and new.status in ('Issued','Awaiting Acknowledgment'))
     or (tg_op = 'UPDATE' and old.status is distinct from new.status and new.status in ('Issued','Awaiting Acknowledgment')) then
    insert into public.notifications (recipient_profile_id, notification_type, title, message, href)
    values (
      new.subject_profile_id,
      'Guardian Issued',
      'New Guardian ready for acknowledgment',
      'G-' || lpad(new.guardian_number::text, 4, '0') || ' has been added to your personnel record.',
      '/portal/personnel#guardians'
    );
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status and new.status in ('Approved','Denied') then
    insert into public.notifications (recipient_profile_id, notification_type, title, message, href)
    values (
      new.author_profile_id,
      'Guardian Review',
      'Guardian ' || lower(new.status),
      'G-' || lpad(new.guardian_number::text, 4, '0') || ' was ' || lower(new.status) || ' by command.',
      '/portal/command/guardians'
    );
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'Acknowledged' then
    insert into public.notifications (recipient_profile_id, notification_type, title, message, href)
    values (
      new.author_profile_id,
      'Guardian Acknowledged',
      'Guardian acknowledged by member',
      'G-' || lpad(new.guardian_number::text, 4, '0') || ' has been acknowledged.',
      '/portal/command/guardians'
    );
  end if;

  return new;
end;
$$;

create trigger guardian_status_notifications
after insert or update of status on public.guardian_records
for each row execute function app_private.notify_guardian_status();

create trigger guardian_acknowledgments_audit
after insert or update or delete on public.guardian_acknowledgments
for each row execute function app_private.write_audit_log();
