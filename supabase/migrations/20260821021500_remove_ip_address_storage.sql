alter table public.session_events
  drop column if exists ip_address;

comment on table public.guardian_acknowledgments is
  'Internal Guardian receipt acknowledgments. IP addresses are not collected or stored.';
