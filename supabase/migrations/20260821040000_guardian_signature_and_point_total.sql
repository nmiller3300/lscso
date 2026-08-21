create or replace function public.get_guardian_point_total(target_profile_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile uuid := app_private.current_profile_id();
  current_tier text := app_private.current_access_tier();
  total integer;
begin
  if current_profile is null or current_tier not in ('Executive','Command','Supervisor','Preliminary') then
    raise exception 'Supervisor authority required';
  end if;

  if not exists (
    select 1
    from public.personnel_profiles profile
    where profile.id = target_profile_id
      and profile.status <> 'Deactivated'
  ) then
    raise exception 'Personnel profile is unavailable';
  end if;

  select coalesce(sum(record.points_assessed), 0)::integer
  into total
  from public.guardian_records record
  where record.subject_profile_id = target_profile_id
    and record.record_type <> 'Commendation'
    and record.status in (
      'Approved',
      'Issued',
      'Awaiting Acknowledgment',
      'Acknowledged',
      'Follow-Up Due',
      'Closed'
    );

  return total;
end;
$$;

revoke all on function public.get_guardian_point_total(uuid) from public, anon;
grant execute on function public.get_guardian_point_total(uuid) to authenticated;

create or replace function public.acknowledge_guardian(
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
  normalized_signature text;
  normalized_display_name text;
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
  normalized_signature := lower(regexp_replace(trim(coalesce(signature_name, '')), '\s+', ' ', 'g'));
  normalized_display_name := lower(regexp_replace(trim(current_profile.display_name), '\s+', ' ', 'g'));

  if is_negative and normalized_signature <> normalized_display_name then
    raise exception 'Type your full personnel name exactly as shown to acknowledge this Guardian';
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
