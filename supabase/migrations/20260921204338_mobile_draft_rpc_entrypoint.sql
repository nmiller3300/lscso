-- Keep app_private inaccessible to browser roles. Expose one narrow authenticated wrapper.
revoke all on function app_private.mobile_save_guardian_draft(uuid,jsonb) from authenticated;
create or replace function public.mobile_save_guardian_draft(p_id uuid,p_payload jsonb)
returns public.guardian_records language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or app_private.current_profile_id() is null then
    raise exception 'Active authenticated personnel required' using errcode='42501';
  end if;
  return app_private.mobile_save_guardian_draft(p_id,p_payload);
end $$;
revoke all on function public.mobile_save_guardian_draft(uuid,jsonb) from public,anon,service_role;
grant execute on function public.mobile_save_guardian_draft(uuid,jsonb) to authenticated;
