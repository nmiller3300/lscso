-- Command Orders are visible in portal navigation for multiple access tiers.
-- These SELECT policies restore the corresponding read access while preserving
-- command-only visibility for drafts/archive and audience-scoped active orders.

create policy command_orders_read on public.command_orders
for select to authenticated
using (
  (select app_private.current_access_tier()) in ('Executive','Command')
  or (
    status = 'Active'
    and (
      target_audience = 'All Personnel'
      or (
        target_audience = 'Supervisors & Command'
        and (select app_private.current_access_tier()) in ('Executive','Command','Supervisor','Preliminary')
      )
      or (
        target_audience = 'Command Only'
        and (select app_private.current_access_tier()) in ('Executive','Command')
      )
    )
  )
);

create policy command_order_acknowledgments_read on public.command_order_acknowledgments
for select to authenticated
using (
  profile_id = (select app_private.current_profile_id())
  or (select app_private.current_access_tier()) in ('Executive','Command')
);
