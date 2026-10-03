create table if not exists public.discord_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 256),
  body text not null check (char_length(body) between 1 and 3900),
  image_url text,
  image_path text,
  discord_message_id text,
  discord_channel_id text not null default '1540393451542159542',
  issued_by_profile_id uuid not null references public.personnel_profiles(id) on delete restrict,
  issued_by_display_name text not null,
  issued_by_rank text not null,
  sent_at timestamptz not null default now()
);

create index if not exists discord_announcements_sent_at_idx on public.discord_announcements(sent_at desc);
create index if not exists discord_announcements_issued_by_idx on public.discord_announcements(issued_by_profile_id);

alter table public.discord_announcements enable row level security;
revoke all on table public.discord_announcements from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'discord-announcements',
  'discord-announcements',
  true,
  8388608,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.send_lscso_discord_announcement(
  p_actor_profile_id uuid,
  p_title text,
  p_message text,
  p_image_url text default null,
  p_image_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.personnel_profiles%rowtype;
  v_webhook text;
  v_payload jsonb;
  v_embed jsonb;
  v_response extensions.http_response;
  v_message_id text;
  v_title text := btrim(coalesce(p_title, ''));
  v_message text := btrim(coalesce(p_message, ''));
begin
  select * into v_actor
  from public.personnel_profiles
  where id = p_actor_profile_id
    and status in ('Active','Acting')
  limit 1;

  if v_actor.id is null or v_actor.rank not in ('Captain','Major','Undersheriff','Sheriff') then
    raise exception 'Captain or higher authority is required.';
  end if;

  if char_length(v_title) < 1 or char_length(v_title) > 256 then
    raise exception 'Announcement title must be between 1 and 256 characters.';
  end if;
  if char_length(v_message) < 1 or char_length(v_message) > 3900 then
    raise exception 'Announcement message must be between 1 and 3900 characters.';
  end if;
  if nullif(p_image_url, '') is not null and p_image_url not like 'https://ksumxsdoaporjadqlpze.supabase.co/storage/v1/object/public/discord-announcements/%' then
    raise exception 'Announcement image URL is not from the approved LSCSO image store.';
  end if;

  select decrypted_secret into v_webhook
  from vault.decrypted_secrets
  where name = 'lscso_discord_announcement_webhook'
  order by created_at desc
  limit 1;

  if nullif(v_webhook, '') is null then
    raise exception 'LSCSO announcement webhook is not configured.';
  end if;

  v_embed := jsonb_build_object(
    'author', jsonb_build_object(
      'name', 'LOS SANTOS COUNTY SHERIFF''S OFFICE · COMMAND',
      'icon_url', 'https://lscsogov.vercel.app/images/lscso-portal-patch.webp'
    ),
    'title', v_title,
    'description', v_message,
    'color', 12757085,
    'thumbnail', jsonb_build_object('url', 'https://lscsogov.vercel.app/images/lscso-portal-patch.webp'),
    'fields', jsonb_build_array(
      jsonb_build_object('name', 'ISSUED BY', 'value', v_actor.rank || ' ' || v_actor.display_name, 'inline', true),
      jsonb_build_object('name', 'OFFICIAL NOTICE', 'value', 'Los Santos County Sheriff''s Office', 'inline', true)
    ),
    'footer', jsonb_build_object('text', 'LSCSO Command Announcement'),
    'timestamp', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  if nullif(p_image_url, '') is not null then
    v_embed := v_embed || jsonb_build_object('image', jsonb_build_object('url', p_image_url));
  end if;

  v_payload := jsonb_build_object(
    'username', 'LSCSO Command',
    'avatar_url', 'https://lscsogov.vercel.app/images/lscso-portal-patch.webp',
    'content', '<@&1540544832597135481>',
    'allowed_mentions', jsonb_build_object('parse', jsonb_build_array(), 'roles', jsonb_build_array('1540544832597135481')),
    'embeds', jsonb_build_array(v_embed)
  );

  v_response := extensions.http_post(
    (v_webhook || '?wait=true')::varchar,
    v_payload::text::varchar,
    'application/json'::varchar
  );

  if v_response.status < 200 or v_response.status >= 300 then
    raise exception 'Discord rejected the announcement (HTTP %).', v_response.status;
  end if;

  begin
    v_message_id := v_response.content::jsonb ->> 'id';
  exception when others then
    v_message_id := null;
  end;

  insert into public.discord_announcements (
    title, body, image_url, image_path, discord_message_id, discord_channel_id,
    issued_by_profile_id, issued_by_display_name, issued_by_rank
  ) values (
    v_title, v_message, nullif(p_image_url,''), nullif(p_image_path,''), v_message_id, '1540393451542159542',
    v_actor.id, v_actor.display_name, v_actor.rank
  );

  return jsonb_build_object(
    'ok', true,
    'message_id', v_message_id,
    'channel_id', '1540393451542159542',
    'sent_at', now()
  );
end;
$$;

revoke all on function public.send_lscso_discord_announcement(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.send_lscso_discord_announcement(uuid,text,text,text,text) to service_role;
