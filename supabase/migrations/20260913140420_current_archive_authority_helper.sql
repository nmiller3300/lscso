create or replace function public.can_manage_current_administration_archive()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.personnel_profiles p
    where p.auth_user_id = auth.uid()
      and p.rank in ('Sheriff','Undersheriff')
      and p.status in ('Active','Acting')
  );
$$;

revoke all on function public.can_manage_current_administration_archive() from public;
grant execute on function public.can_manage_current_administration_archive() to authenticated;
