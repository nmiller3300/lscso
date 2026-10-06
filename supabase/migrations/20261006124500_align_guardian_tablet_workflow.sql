-- Align AEGIS tablet Guardian workflow with the production personnel portal.
-- Written Warnings may be issued directly by supervisors.
-- Write-Ups require Command approval.
-- Commendations remain Command-only.

create or replace function app_private.mobile_save_guardian_draft(p_id uuid,p_payload jsonb)
returns public.guardian_records
language plpgsql
security definer
set search_path='' as $$
declare
  actor uuid := app_private.current_profile_id();
  actor_tier text;
  old_record public.guardian_records;
  result public.guardian_records;
  wanted text := p_payload->>'status';
  kind text := p_payload->>'record_type';
  subject uuid := (p_payload->>'subject_profile_id')::uuid;
begin
  if auth.uid() is null or actor is null then
    raise exception 'Active authenticated personnel required' using errcode='42501';
  end if;

  select access_tier into actor_tier
  from public.personnel_profiles
  where id = actor;

  select * into old_record
  from public.guardian_records
  where id = p_id
  for update;

  if old_record.id is null or old_record.author_profile_id <> actor then
    raise exception 'Only the author can edit this Guardian' using errcode='42501';
  end if;

  if old_record.status <> 'Draft' then
    return old_record;
  end if;

  if not app_private.current_can_guardian_subject(subject) or subject = actor then
    raise exception 'Subject is outside your purview' using errcode='42501';
  end if;

  if kind not in ('Feedback','Written Warning','Write-Up','Commendation')
     or kind is null
     or wanted is null
     or wanted not in ('Draft','Pending Approval','Awaiting Acknowledgment') then
    raise exception 'Invalid Guardian workflow';
  end if;

  if kind = 'Commendation' and actor_tier not in ('Executive','Command') then
    raise exception 'Commendations may only be authored by Command staff' using errcode='42501';
  end if;

  if wanted = 'Awaiting Acknowledgment' and kind = 'Write-Up' then
    raise exception 'Command approval required';
  end if;

  if wanted = 'Pending Approval' and kind <> 'Write-Up' then
    raise exception 'Only Write-Ups require Command approval';
  end if;

  if length(trim(coalesce(p_payload->>'title',''))) < 4
     or length(trim(coalesce(p_payload->>'observed_behavior',''))) < 10 then
    raise exception 'Title and narrative required';
  end if;

  update public.guardian_records
  set subject_profile_id = subject,
      record_type = kind,
      status = wanted,
      title = left(p_payload->>'title',160),
      incident_at = (p_payload->>'incident_at')::timestamptz,
      location = left(p_payload->>'location',240),
      policy_reference = left(p_payload->>'policy_reference',1000),
      observed_behavior = left(p_payload->>'observed_behavior',10000),
      expected_standard = left(p_payload->>'expected_standard',10000),
      action_taken = left(p_payload->>'action_taken',10000),
      follow_up_plan = left(p_payload->>'follow_up_plan',4000),
      follow_up_due_at = nullif(p_payload->>'follow_up_due_at','')::timestamptz,
      points_assessed = case
        when kind = 'Commendation' then 0
        else coalesce((p_payload->>'points_assessed')::integer,0)
      end,
      submitted_at = case when wanted='Draft' then null else now() end,
      issued_at = case when wanted='Awaiting Acknowledgment' then now() else null end
  where id = p_id
  returning * into result;

  return result;
end
$$;
