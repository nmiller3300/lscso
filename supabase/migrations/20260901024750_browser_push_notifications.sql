create extension if not exists pg_net;

create table if not exists public.browser_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.personnel_profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled boolean not null default true,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists browser_push_subscriptions_profile_idx
  on public.browser_push_subscriptions(profile_id, enabled);

alter table public.browser_push_subscriptions enable row level security;

create policy browser_push_subscriptions_select_own
on public.browser_push_subscriptions
for select to authenticated
using (profile_id = (select app_private.current_profile_id()));

revoke all on public.browser_push_subscriptions from anon, authenticated;
grant select on public.browser_push_subscriptions to authenticated;

create or replace function public.register_browser_push_subscription(
  push_endpoint text,
  push_p256dh text,
  push_auth text,
  push_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile uuid;
  subscription_id uuid;
begin
  current_profile := app_private.current_profile_id();
  if current_profile is null then
    raise exception 'Authorized profile required';
  end if;

  if nullif(btrim(push_endpoint), '') is null
    or nullif(btrim(push_p256dh), '') is null
    or nullif(btrim(push_auth), '') is null then
    raise exception 'Complete push subscription required';
  end if;

  insert into public.browser_push_subscriptions (
    profile_id, endpoint, p256dh, auth, user_agent, enabled, failure_count, updated_at
  ) values (
    current_profile, btrim(push_endpoint), btrim(push_p256dh), btrim(push_auth),
    nullif(btrim(push_user_agent), ''), true, 0, now()
  )
  on conflict (endpoint) do update set
    profile_id = excluded.profile_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    enabled = true,
    failure_count = 0,
    updated_at = now()
  returning id into subscription_id;

  return subscription_id;
end;
$$;

create or replace function public.unregister_browser_push_subscription(push_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile uuid;
  removed_count integer;
begin
  current_profile := app_private.current_profile_id();
  if current_profile is null then
    raise exception 'Authorized profile required';
  end if;

  delete from public.browser_push_subscriptions
  where endpoint = push_endpoint
    and profile_id = current_profile;

  get diagnostics removed_count = row_count;
  return removed_count > 0;
end;
$$;

revoke all on function public.register_browser_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.unregister_browser_push_subscription(text) from public, anon;
grant execute on function public.register_browser_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.unregister_browser_push_subscription(text) to authenticated;

create or replace function public.browser_push_delivery_secrets()
returns table(vapid_private_key text, webhook_secret text)
language sql
security definer
set search_path = ''
as $$
  select
    max(case when name = 'lscso_vapid_private_key' then decrypted_secret end)::text,
    max(case when name = 'lscso_push_webhook_secret' then decrypted_secret end)::text
  from vault.decrypted_secrets
  where name in ('lscso_vapid_private_key', 'lscso_push_webhook_secret')
$$;

revoke all on function public.browser_push_delivery_secrets() from public, anon, authenticated;
grant execute on function public.browser_push_delivery_secrets() to service_role;

create or replace function app_private.enqueue_browser_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  push_secret text;
begin
  select decrypted_secret into push_secret
  from vault.decrypted_secrets
  where name = 'lscso_push_webhook_secret'
  order by created_at desc
  limit 1;

  if push_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://ksumxsdoaporjadqlpze.supabase.co/functions/v1/browser-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-lscso-push-secret', push_secret
    ),
    body := jsonb_build_object('notification_id', new.id)
  );

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists notifications_browser_push on public.notifications;
create trigger notifications_browser_push
after insert on public.notifications
for each row execute function app_private.enqueue_browser_push();
