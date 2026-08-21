-- Least-privilege Data API grants for LSCSO.
-- RLS remains the row-level authorization layer; grants now limit which operations
-- are reachable at all through PostgREST/supabase-js.

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all tables in schema public from authenticated;

-- Read-only portal data.
grant select on table public.acting_supervisor_grants to authenticated;
grant select on table public.audit_log to authenticated;
grant select on table public.call_sign_assignments to authenticated;
grant select on table public.certifications to authenticated;
grant select on table public.command_announcements to authenticated;
grant select on table public.disciplinary_point_tiers to authenticated;
grant select on table public.division_assignments to authenticated;
grant select on table public.guardian_acknowledgments to authenticated;
grant select on table public.personnel_profiles to authenticated;
grant select on table public.session_events to authenticated;
grant select on table public.training_progress to authenticated;

-- Guardian authoring is a browser workflow. System-owned fields are additionally
-- protected by guardian_system_fields and RLS.
grant select, insert, update on table public.guardian_records to authenticated;

-- Personnel self-service requests may be created/edited by their owner. Command
-- decisions are performed through the guarded review_personnel_request RPC.
grant select, insert, update on table public.personnel_requests to authenticated;

-- Notifications are immutable except for the recipient's read timestamp.
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

-- Fix self-service request escalation: requesters may only keep their own request
-- in Draft or Submitted. Command review occurs through the RPC, not direct UPDATE.
drop policy if exists personnel_requests_update on public.personnel_requests;
create policy personnel_requests_update
on public.personnel_requests
for update
to authenticated
using (
  requester_profile_id = (select app_private.current_profile_id())
  and status in ('Draft','Submitted')
)
with check (
  requester_profile_id = (select app_private.current_profile_id())
  and status in ('Draft','Submitted')
);

-- Public schema functions are deny-by-default. Regrant only the RPC surface the
-- signed-in portal actually uses. Service-role-only admin helpers remain private
-- to the Edge Function/service role.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;

grant execute on function public.acknowledge_guardian(uuid, text, text) to authenticated;
grant execute on function public.get_guardian_point_total(uuid) to authenticated;
grant execute on function public.issue_guardian(uuid) to authenticated;
grant execute on function public.record_session_event(text, text) to authenticated;
grant execute on function public.review_guardian(uuid, text, text) to authenticated;
grant execute on function public.review_personnel_request(uuid, text, text) to authenticated;

-- Future objects are also deny-by-default so a later table/function cannot become
-- browser-accessible accidentally.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on tables from authenticated;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from authenticated;
