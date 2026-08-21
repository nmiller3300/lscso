-- DESIGN DRAFT ONLY. DO NOT APPLY TO PRODUCTION YET.
-- Extends the existing notifications table so one LSCSO event can drive the
-- portal inbox now and Discord embeds later without duplicating business logic.

alter table public.notifications
  add column if not exists event_key text,
  add column if not exists category text check (category in ('Personnel','Guardians','Requests','Training','Recognition','System')),
  add column if not exists priority text not null default 'Normal' check (priority in ('Critical','High','Normal','Low')),
  add column if not exists action_required boolean not null default false,
  add column if not exists source_type text,
  add column if not exists source_record_id text,
  add column if not exists subject_profile_id uuid references public.personnel_profiles(id) on delete set null,
  add column if not exists actor_profile_id uuid references public.personnel_profiles(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists notifications_action_queue_idx
  on public.notifications (recipient_profile_id, action_required, read_at, created_at desc);

create index if not exists notifications_source_idx
  on public.notifications (source_type, source_record_id)
  where source_record_id is not null;

create unique index if not exists notifications_recipient_event_unique
  on public.notifications (recipient_profile_id, event_key)
  where event_key is not null;

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('Portal','Discord')),
  destination_key text,
  status text not null default 'Pending' check (status in ('Pending','Sent','Failed','Suppressed')),
  attempted_at timestamptz,
  delivered_at timestamptz,
  external_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  unique (notification_id, channel, destination_key)
);

create index if not exists notification_deliveries_status_idx
  on public.notification_deliveries (channel, status, created_at);

-- Discord configuration should be stored separately and never exposed through
-- client-readable tables. Webhook secrets belong in server-side environment/
-- secret storage, while this table only records delivery state and message IDs.
