-- LSCSO case number generator.
-- Separate yearly sequences are maintained for arrest warrants, traffic stops, and use-of-force incidents.

create table app_private.case_number_sequences (
  case_type text not null,
  case_year integer not null,
  last_sequence bigint not null,
  updated_at timestamptz not null default now(),
  constraint case_number_sequences_pkey primary key (case_type, case_year),
  constraint case_number_sequences_type_check check (
    case_type = any (array['arrest_warrant'::text, 'traffic_stop'::text, 'use_of_force'::text])
  ),
  constraint case_number_sequences_last_sequence_check check (last_sequence > 0)
);

create table public.case_numbers (
  id uuid not null default gen_random_uuid(),
  case_number text not null,
  case_type text not null,
  case_year integer not null,
  sequence_no bigint not null,
  generated_by_profile_id uuid not null,
  generated_at timestamptz not null default now(),
  status text not null default 'Issued'::text,
  voided_at timestamptz,
  voided_by_profile_id uuid,
  void_reason text,
  constraint case_numbers_pkey primary key (id),
  constraint case_numbers_case_number_key unique (case_number),
  constraint case_numbers_sequence_unique unique (case_type, case_year, sequence_no),
  constraint case_numbers_generated_by_profile_id_fkey
    foreign key (generated_by_profile_id) references public.personnel_profiles(id) on delete restrict,
  constraint case_numbers_voided_by_profile_id_fkey
    foreign key (voided_by_profile_id) references public.personnel_profiles(id) on delete restrict,
  constraint case_numbers_type_check check (
    case_type = any (array['arrest_warrant'::text, 'traffic_stop'::text, 'use_of_force'::text])
  ),
  constraint case_numbers_status_check check (
    status = any (array['Issued'::text, 'Void'::text])
  ),
  constraint case_numbers_void_state_check check (
    (
      status = 'Issued'::text
      and voided_at is null
      and voided_by_profile_id is null
      and void_reason is null
    )
    or
    (
      status = 'Void'::text
      and voided_at is not null
      and voided_by_profile_id is not null
      and void_reason is not null
    )
  )
);

create index case_numbers_generated_at_idx
  on public.case_numbers (generated_at desc);

create index case_numbers_generated_by_idx
  on public.case_numbers (generated_by_profile_id, generated_at desc);

alter table public.case_numbers enable row level security;

revoke all on table public.case_numbers from public, anon, authenticated;
grant all on table public.case_numbers to service_role;

revoke all on table app_private.case_number_sequences from public, anon, authenticated;

create or replace function public.generate_case_number(p_case_type text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_actor_status text;
  v_case_type text := lower(trim(coalesce(p_case_type, '')));
  v_prefix text;
  v_label text;
  v_year integer;
  v_sequence bigint;
  v_case_number text;
  v_id uuid;
begin
  v_actor := app_private.current_profile_id();
  if v_actor is null then
    raise exception 'Authenticated personnel profile required.';
  end if;

  select p.status
    into v_actor_status
  from public.personnel_profiles p
  where p.id = v_actor;

  if v_actor_status is null or v_actor_status not in ('Active', 'Acting') then
    raise exception 'Only active LSCSO personnel may generate case numbers.';
  end if;

  case v_case_type
    when 'arrest_warrant' then
      v_prefix := 'AW';
      v_label := 'Arrest Warrant Application';
    when 'traffic_stop' then
      v_prefix := 'TSR';
      v_label := 'Traffic Stop Report';
    when 'use_of_force' then
      v_prefix := 'UOF';
      v_label := 'Use of Force Incident';
    else
      raise exception 'Unsupported case number type.';
  end case;

  v_year := extract(year from timezone('America/New_York', now()))::integer;

  insert into app_private.case_number_sequences (case_type, case_year, last_sequence, updated_at)
  values (v_case_type, v_year, 1, now())
  on conflict (case_type, case_year)
  do update set
    last_sequence = app_private.case_number_sequences.last_sequence + 1,
    updated_at = now()
  returning last_sequence into v_sequence;

  v_case_number := v_prefix || '-' || v_year::text || '-' || lpad(v_sequence::text, 6, '0');

  insert into public.case_numbers (
    case_number,
    case_type,
    case_year,
    sequence_no,
    generated_by_profile_id
  ) values (
    v_case_number,
    v_case_type,
    v_year,
    v_sequence,
    v_actor
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'case_number', v_case_number,
    'case_type', v_case_type,
    'case_label', v_label,
    'status', 'Issued',
    'generated_at', now()
  );
end;
$$;

create or replace function public.void_case_number(
  p_case_number text,
  p_reason text default 'Generated in error'::text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_actor_status text;
  v_row public.case_numbers%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  v_actor := app_private.current_profile_id();
  if v_actor is null then
    raise exception 'Authenticated personnel profile required.';
  end if;

  select p.status
    into v_actor_status
  from public.personnel_profiles p
  where p.id = v_actor;

  if v_actor_status is null or v_actor_status not in ('Active', 'Acting') then
    raise exception 'Only active LSCSO personnel may void case numbers.';
  end if;

  if length(v_reason) < 4 then
    raise exception 'A short reason is required to void a case number.';
  end if;

  select *
    into v_row
  from public.case_numbers
  where case_number = upper(trim(coalesce(p_case_number, '')))
  for update;

  if v_row.id is null then
    raise exception 'Case number not found.';
  end if;

  if v_row.generated_by_profile_id <> v_actor then
    raise exception 'You may only void a case number that you generated.';
  end if;

  if v_row.status = 'Void' then
    return jsonb_build_object(
      'id', v_row.id,
      'case_number', v_row.case_number,
      'status', 'Void',
      'voided_at', v_row.voided_at
    );
  end if;

  update public.case_numbers
  set status = 'Void',
      voided_at = now(),
      voided_by_profile_id = v_actor,
      void_reason = v_reason
  where id = v_row.id;

  return jsonb_build_object(
    'id', v_row.id,
    'case_number', v_row.case_number,
    'status', 'Void',
    'voided_at', now()
  );
end;
$$;

revoke all on function public.generate_case_number(text) from public, anon;
grant execute on function public.generate_case_number(text) to authenticated, service_role;

revoke all on function public.void_case_number(text, text) from public, anon;
grant execute on function public.void_case_number(text, text) to authenticated, service_role;
