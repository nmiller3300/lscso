create table if not exists public.personnel_training_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.personnel_profiles(id) on delete cascade,
  record_type text not null check (record_type in ('Department Training','Prior / Lateral Training')),
  category text not null check (category in ('Academy','FTO','Remedial','Continuing Education','Leadership','Specialty','Other')),
  title text not null check (char_length(btrim(title)) between 2 and 180),
  provider text not null check (char_length(btrim(provider)) between 2 and 180),
  completed_on date,
  verification_status text not null check (verification_status in ('Completed','Released','Verified','Accepted as Equivalent','Recorded for History Only')),
  notes text check (notes is null or char_length(notes) <= 4000),
  source_document_reference text check (source_document_reference is null or char_length(source_document_reference) <= 500),
  source_training_progress_id uuid unique references public.training_progress(id) on delete set null,
  recorded_by uuid references public.personnel_profiles(id),
  verified_by uuid references public.personnel_profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personnel_training_records_profile_idx
  on public.personnel_training_records(profile_id, completed_on desc nulls last, created_at desc);

create table if not exists public.training_requirement_dispositions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.personnel_profiles(id) on delete cascade,
  requirement text not null check (requirement in ('Academy','FTO')),
  disposition text not null check (disposition in ('Required','In Progress','Completed','Not Required','Waived')),
  reason text not null check (char_length(btrim(reason)) between 4 and 2000),
  authorized_by uuid not null references public.personnel_profiles(id),
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists training_requirement_dispositions_profile_idx
  on public.training_requirement_dispositions(profile_id, requirement, effective_at desc);

alter table public.personnel_training_records enable row level security;
alter table public.training_requirement_dispositions enable row level security;

revoke all on public.personnel_training_records from anon;
revoke all on public.personnel_training_records from authenticated;
grant select on public.personnel_training_records to authenticated;

revoke all on public.training_requirement_dispositions from anon;
revoke all on public.training_requirement_dispositions from authenticated;
grant select on public.training_requirement_dispositions to authenticated;

drop policy if exists personnel_training_records_read on public.personnel_training_records;
create policy personnel_training_records_read
on public.personnel_training_records
for select
to authenticated
using (
  profile_id = app_private.current_profile_id()
  or app_private.current_can_manage_roster_training()
  or exists (
    select 1
    from public.training_progress tp
    where tp.profile_id = personnel_training_records.profile_id
      and tp.evaluator_profile_id = app_private.current_profile_id()
      and tp.status in ('Not Started','In Progress','Needs Improvement')
  )
);

drop policy if exists training_requirement_dispositions_read on public.training_requirement_dispositions;
create policy training_requirement_dispositions_read
on public.training_requirement_dispositions
for select
to authenticated
using (
  profile_id = app_private.current_profile_id()
  or app_private.current_can_manage_roster_training()
  or exists (
    select 1
    from public.training_progress tp
    where tp.profile_id = training_requirement_dispositions.profile_id
      and tp.evaluator_profile_id = app_private.current_profile_id()
      and tp.status in ('Not Started','In Progress','Needs Improvement')
  )
);

create or replace function public.record_personnel_training_history(
  p_profile_id uuid,
  p_record_type text,
  p_category text,
  p_title text,
  p_provider text,
  p_completed_on date default null,
  p_verification_status text default 'Verified',
  p_notes text default null,
  p_source_document_reference text default null
)
returns public.personnel_training_records
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
  v_result public.personnel_training_records;
begin
  if v_actor is null or not app_private.current_can_manage_roster_training() then
    raise exception 'Training administration authority required';
  end if;
  if not exists(select 1 from public.personnel_profiles where id = p_profile_id) then
    raise exception 'Personnel record not found';
  end if;
  if p_record_type not in ('Department Training','Prior / Lateral Training') then
    raise exception 'Invalid training record type';
  end if;
  if p_category not in ('Academy','FTO','Remedial','Continuing Education','Leadership','Specialty','Other') then
    raise exception 'Invalid training category';
  end if;
  if nullif(btrim(coalesce(p_title,'')),'') is null or char_length(btrim(p_title)) < 2 then
    raise exception 'Training title is required';
  end if;
  if nullif(btrim(coalesce(p_provider,'')),'') is null or char_length(btrim(p_provider)) < 2 then
    raise exception 'Training provider is required';
  end if;
  if p_verification_status not in ('Completed','Released','Verified','Accepted as Equivalent','Recorded for History Only') then
    raise exception 'Invalid verification status';
  end if;

  insert into public.personnel_training_records(
    profile_id,record_type,category,title,provider,completed_on,verification_status,notes,
    source_document_reference,recorded_by,verified_by,verified_at
  ) values (
    p_profile_id,p_record_type,p_category,btrim(p_title),btrim(p_provider),p_completed_on,
    p_verification_status,nullif(btrim(coalesce(p_notes,'')),''),
    nullif(btrim(coalesce(p_source_document_reference,'')),''),v_actor,v_actor,now()
  ) returning * into v_result;

  insert into public.audit_log(actor_user_id,actor_profile_id,action,table_name,record_id,new_data)
  values(auth.uid(),v_actor,'RECORD_TRAINING_HISTORY','personnel_training_records',v_result.id::text,to_jsonb(v_result));

  insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
  values(p_profile_id,'Training','Training record added',v_result.title || ' · ' || v_result.verification_status,'/portal/my-office#training');

  return v_result;
end
$$;

create or replace function public.set_training_requirement_disposition(
  p_profile_id uuid,
  p_requirement text,
  p_disposition text,
  p_reason text
)
returns public.training_requirement_dispositions
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := app_private.current_profile_id();
  v_result public.training_requirement_dispositions;
begin
  if v_actor is null or not app_private.current_can_manage_roster_training() then
    raise exception 'Training administration authority required';
  end if;
  if not exists(select 1 from public.personnel_profiles where id = p_profile_id) then
    raise exception 'Personnel record not found';
  end if;
  if p_requirement not in ('Academy','FTO') then raise exception 'Invalid training requirement'; end if;
  if p_disposition not in ('Required','In Progress','Completed','Not Required','Waived') then raise exception 'Invalid disposition'; end if;
  if char_length(btrim(coalesce(p_reason,''))) < 4 then raise exception 'A clear reason is required'; end if;

  insert into public.training_requirement_dispositions(profile_id,requirement,disposition,reason,authorized_by)
  values(p_profile_id,p_requirement,p_disposition,btrim(p_reason),v_actor)
  returning * into v_result;

  insert into public.audit_log(actor_user_id,actor_profile_id,action,table_name,record_id,new_data)
  values(auth.uid(),v_actor,'SET_TRAINING_REQUIREMENT','training_requirement_dispositions',v_result.id::text,to_jsonb(v_result));

  insert into public.notifications(recipient_profile_id,notification_type,title,message,href)
  values(p_profile_id,'Training',p_requirement || ' requirement updated',p_disposition || ' · ' || btrim(p_reason),'/portal/my-office#training');

  return v_result;
end
$$;

create or replace function app_private.sync_completed_training_history()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid;
  v_title text;
  v_verification text;
begin
  if new.status not in ('Complete','Released') then
    return new;
  end if;

  v_actor := coalesce(app_private.current_profile_id(), new.evaluator_profile_id);
  v_title := case
    when new.program_type = 'FTO' then 'Field Training Program'
    when new.program_type = 'Academy' then 'LSCSO Academy'
    else new.program_type
  end;
  v_verification := case when new.status = 'Released' then 'Released' else 'Completed' end;

  insert into public.personnel_training_records(
    profile_id,record_type,category,title,provider,completed_on,verification_status,notes,
    source_training_progress_id,recorded_by,verified_by,verified_at
  ) values (
    new.profile_id,'Department Training',new.program_type,v_title,'Los Santos County Sheriff''s Office',
    coalesce(new.completed_on,current_date),v_verification,new.evaluation_notes,new.id,v_actor,v_actor,now()
  )
  on conflict(source_training_progress_id) do update set
    completed_on=excluded.completed_on,
    verification_status=excluded.verification_status,
    notes=excluded.notes,
    verified_by=excluded.verified_by,
    verified_at=excluded.verified_at,
    updated_at=now();

  return new;
end
$$;

drop trigger if exists training_progress_completed_history on public.training_progress;
create trigger training_progress_completed_history
after insert or update of status,completed_on,evaluation_notes on public.training_progress
for each row execute function app_private.sync_completed_training_history();

grant execute on function public.record_personnel_training_history(uuid,text,text,text,text,date,text,text,text) to authenticated;
grant execute on function public.set_training_requirement_disposition(uuid,text,text,text) to authenticated;
revoke execute on function public.record_personnel_training_history(uuid,text,text,text,text,date,text,text,text) from public, anon;
revoke execute on function public.set_training_requirement_disposition(uuid,text,text,text) from public, anon;

insert into public.personnel_training_records(
  profile_id,record_type,category,title,provider,completed_on,verification_status,notes,
  source_training_progress_id,recorded_by,verified_by,verified_at
)
select
  tp.profile_id,
  'Department Training',
  tp.program_type,
  case when tp.program_type='FTO' then 'Field Training Program' when tp.program_type='Academy' then 'LSCSO Academy' else tp.program_type end,
  'Los Santos County Sheriff''s Office',
  coalesce(tp.completed_on,tp.updated_at::date),
  case when tp.status='Released' then 'Released' else 'Completed' end,
  tp.evaluation_notes,
  tp.id,
  tp.evaluator_profile_id,
  tp.evaluator_profile_id,
  tp.updated_at
from public.training_progress tp
where tp.status in ('Complete','Released')
on conflict(source_training_progress_id) do nothing;
