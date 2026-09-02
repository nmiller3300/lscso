alter table public.personnel_profiles
  add column if not exists probation_started_at timestamptz,
  add column if not exists probation_ends_at timestamptz;

comment on column public.personnel_profiles.probation_started_at is 'Start of the member probationary period. Null when probation does not apply.';
comment on column public.personnel_profiles.probation_ends_at is 'Automatic end of the member probationary period. LSCSO probation lasts 15 days.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.personnel_profiles'::regclass
      and conname = 'personnel_profiles_probation_window_check'
  ) then
    alter table public.personnel_profiles
      add constraint personnel_profiles_probation_window_check
      check (
        (probation_started_at is null and probation_ends_at is null)
        or (
          probation_started_at is not null
          and probation_ends_at is not null
          and probation_ends_at > probation_started_at
        )
      );
  end if;
end $$;

update public.personnel_profiles
set probation_started_at = created_at,
    probation_ends_at = created_at + interval '15 days',
    updated_at = now()
where personnel_id = 'LS-003'
  and is_test_account = false
  and probation_started_at is null
  and probation_ends_at is null;

alter table public.recruitment_applications
  add column if not exists drug_use_history text;

comment on column public.recruitment_applications.drug_use_history is 'Applicant disclosure regarding illegal drug use, non-prescribed medication use, or misuse of controlled substances.';

drop function if exists public.get_public_roster_v2();

create function public.get_public_roster_v2()
returns table(
  personnel_id text,
  display_name text,
  rank text,
  call_sign text,
  display_status text,
  primary_assignment text,
  qualifications text[],
  fto_qualified boolean,
  probationary boolean,
  probation_ends_at timestamptz
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    p.personnel_id,
    p.display_name,
    p.rank,
    p.call_sign,
    case
      when p.status='Suspended' then 'Suspended'
      when exists(
        select 1 from public.leave_requests lr
        where lr.profile_id=p.id
          and lr.status='Approved'
          and current_date between lr.starts_on and lr.expected_return_on
      ) then 'LOA'
      when p.status in ('Active','Acting') then 'Active'
      else 'Inactive'
    end,
    coalesce(primary_unit.name,nullif(p.division,''),'Unassigned'),
    coalesce(cert_list.names,array[]::text[]),
    app_private.profile_is_fto_qualified(p.id),
    (p.probation_ends_at is not null and p.probation_ends_at > now()),
    p.probation_ends_at
  from public.personnel_profiles p
  left join lateral (
    select ou.name
    from public.personnel_unit_assignments a
    join public.organizational_units ou on ou.id=a.organizational_unit_id
    where a.profile_id=p.id
      and a.assignment_type='Primary'
      and a.ends_at is null
      and ou.active
    order by a.starts_at desc
    limit 1
  ) primary_unit on true
  left join lateral (
    select array_agg(c.name order by c.name) names
    from public.certifications c
    where c.profile_id=p.id
      and c.status='Current'
      and (c.expires_on is null or c.expires_on>=current_date)
  ) cert_list on true
  where p.status<>'Deactivated'
    and not p.is_test_account
  order by app_private.rank_level(p.rank) desc nulls last,p.display_name
$function$;

grant execute on function public.get_public_roster_v2() to public, anon, authenticated, service_role;
