drop policy if exists guardian_records_update on public.guardian_records;

create policy guardian_records_update on public.guardian_records
for update to authenticated
using (
  status in ('Draft','Pending Approval')
  and (
    author_profile_id = (select app_private.current_profile_id())
    or (select app_private.current_access_tier()) in ('Executive','Command')
  )
)
with check (
  status in ('Draft','Pending Approval')
  and (
    author_profile_id = (select app_private.current_profile_id())
    or (select app_private.current_access_tier()) in ('Executive','Command')
  )
);

create or replace function public.issue_guardian(record_id uuid)
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
  if current_profile is null or current_tier not in ('Executive','Command','Supervisor','Preliminary') then
    raise exception 'Supervisor authority required';
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
