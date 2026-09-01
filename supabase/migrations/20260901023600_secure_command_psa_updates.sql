revoke select on table public.site_psa from anon, authenticated;
grant select (id, message, is_active, updated_at) on public.site_psa to anon;
grant select, insert, update on table public.site_psa to authenticated;

drop policy if exists "Public can read homepage PSA" on public.site_psa;
create policy "Public can read homepage PSA"
on public.site_psa
for select
to anon, authenticated
using (id = 'homepage');

drop policy if exists "Command can insert homepage PSA" on public.site_psa;
create policy "Command can insert homepage PSA"
on public.site_psa
for insert
to authenticated
with check (
  id = 'homepage'
  and (select app_private.current_access_tier()) = any (array['Executive'::text, 'Command'::text])
  and updated_by_profile_id = (select app_private.current_profile_id())
);

drop policy if exists "Command can update homepage PSA" on public.site_psa;
create policy "Command can update homepage PSA"
on public.site_psa
for update
to authenticated
using (
  id = 'homepage'
  and (select app_private.current_access_tier()) = any (array['Executive'::text, 'Command'::text])
)
with check (
  id = 'homepage'
  and (select app_private.current_access_tier()) = any (array['Executive'::text, 'Command'::text])
  and updated_by_profile_id = (select app_private.current_profile_id())
);

create or replace function app_private.audit_site_psa_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_log (
    actor_user_id,
    actor_profile_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) values (
    auth.uid(),
    new.updated_by_profile_id,
    case
      when tg_op = 'INSERT' then 'Created public PSA'
      when old.is_active is distinct from new.is_active and new.is_active then 'Enabled public PSA'
      when old.is_active is distinct from new.is_active and not new.is_active then 'Disabled public PSA'
      else 'Updated public PSA'
    end,
    'site_psa',
    new.id,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );
  return new;
end;
$$;

revoke all on function app_private.audit_site_psa_change() from public;

drop trigger if exists site_psa_audit_trigger on public.site_psa;
create trigger site_psa_audit_trigger
after insert or update on public.site_psa
for each row execute function app_private.audit_site_psa_change();
