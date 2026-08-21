-- DESIGN DRAFT ONLY. DO NOT APPLY TO PRODUCTION YET.
-- One LSCSO event may create one or more personal portal notifications and,
-- later, a single Discord embed. Delivery channels do not duplicate business logic.

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  category text not null check (category in ('Personnel','Guardians','Requests','Training','Recognition','System')),
  priority text not null default 'Normal' check (priority in ('Critical','High','Normal','Low')),
  title text not null,
  message text not null,
  href text,
  action_required boolean not null default false,
  source_type text,
  source_record_id text,
  subject_profile_id uuid references public.personnel_profiles(id) on delete set null,
  actor_profile_id uuid references public.personnel_profiles(id) on delete set null,
  audience_scope text not null default 'Direct' check (audience_scope in ('Direct','Purview','Command','Department','System')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index notification_events_source_idx
  on public.notification_events (source_type, source_record_id)
  where source_record_id is not null;
create index notification_events_action_idx
  on public.notification_events (action_required, priority, created_at desc);

alter table public.notifications
  add column if not exists event_id uuid references public.notification_events(id) on delete set null;

create unique index notifications_recipient_event_unique
  on public.notifications (recipient_profile_id, event_id)
  where event_id is not null;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events(id) on delete cascade,
  channel text not null check (channel in ('Discord')),
  destination_key text not null,
  status text not null default 'Pending' check (status in ('Pending','Sent','Failed','Suppressed')),
  attempted_at timestamptz,
  delivered_at timestamptz,
  external_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  unique (event_id, channel, destination_key)
);

create index notification_deliveries_status_idx
  on public.notification_deliveries (channel, status, created_at);

-- Portal delivery is represented by the existing per-recipient notifications
-- table. Discord delivery is represented once per event/destination, preventing
-- five Command recipients from creating five copies of the same Discord embed.
--
-- Discord webhook secrets/configuration must remain server-side. destination_key
-- is a logical channel mapping such as 'command-alerts' or 'training', never a
-- webhook URL or secret stored in a client-readable row.
