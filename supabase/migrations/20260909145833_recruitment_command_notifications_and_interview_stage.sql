alter table public.recruitment_application_history
  drop constraint if exists recruitment_application_history_event_type_check;

alter table public.recruitment_application_history
  add constraint recruitment_application_history_event_type_check
  check (event_type in (
    'Submitted','Reviewer Assigned','Status Changed','Approved for Interview',
    'Interview Updated','Note Added','Accepted','Denied','Hired In Game'
  ));

create or replace function app_private.notify_recruitment_application_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_webhook text;
  v_role_id text;
  v_label text := 'APP-' || lpad(new.application_number::text, 4, '0');
begin
  insert into public.notifications (
    recipient_profile_id,
    notification_type,
    title,
    message,
    href
  )
  select
    p.id,
    'Recruitment Application',
    'New application received',
    v_label || ' · ' || new.full_name || ' is waiting for initial review.',
    '/portal/command/applications/' || new.id::text
  from public.personnel_profiles p
  where p.status in ('Active','Acting')
    and p.rank in ('Sheriff','Undersheriff','Major','Captain');

  begin
    select decrypted_secret into v_webhook
    from vault.decrypted_secrets
    where name = 'lscso_discord_application_webhook'
    order by created_at desc
    limit 1;

    select decrypted_secret into v_role_id
    from vault.decrypted_secrets
    where name = 'lscso_discord_hiring_role_id'
    order by created_at desc
    limit 1;

    if nullif(v_webhook, '') is not null then
      perform net.http_post(
        url := v_webhook,
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object(
          'content', case when nullif(v_role_id, '') is not null then '<@&' || v_role_id || '> New LSCSO application received.' else 'New LSCSO application received.' end,
          'allowed_mentions', case when nullif(v_role_id, '') is not null then jsonb_build_object('roles', jsonb_build_array(v_role_id)) else jsonb_build_object('parse', jsonb_build_array()) end,
          'embeds', jsonb_build_array(jsonb_build_object(
            'title', 'LSCSO Recruitment · New Application',
            'description', new.full_name || ' submitted ' || v_label || '.',
            'fields', jsonb_build_array(
              jsonb_build_object('name','Applicant','value',left(new.full_name,1024),'inline',true),
              jsonb_build_object('name','Discord','value',left(new.discord_username,1024),'inline',true),
              jsonb_build_object('name','Status','value','Submitted · awaiting initial review','inline',false)
            ),
            'footer', jsonb_build_object('text','Captain+ have also been notified in the Command Portal'),
            'timestamp', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ))
        )
      );
    end if;
  exception when others then
    null;
  end;

  return new;
end;
$$;

drop trigger if exists recruitment_application_created_notifications on public.recruitment_applications;
create trigger recruitment_application_created_notifications
after insert on public.recruitment_applications
for each row execute function app_private.notify_recruitment_application_created();

create or replace function app_private.notify_recruitment_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_webhook text;
  v_role_id text;
  v_label text := 'APP-' || lpad(new.application_number::text, 4, '0');
  v_status_label text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_status_label := case new.status
    when 'Interview' then 'Approved for Interview'
    when 'Accepted' then 'Accepted after Interview'
    when 'Denied' then 'Denied'
    else new.status
  end;

  if new.status in ('Interview','Accepted','Denied') then
    begin
      select decrypted_secret into v_webhook
      from vault.decrypted_secrets
      where name = 'lscso_discord_application_webhook'
      order by created_at desc
      limit 1;

      select decrypted_secret into v_role_id
      from vault.decrypted_secrets
      where name = 'lscso_discord_hiring_role_id'
      order by created_at desc
      limit 1;

      if nullif(v_webhook, '') is not null then
        perform net.http_post(
          url := v_webhook,
          headers := jsonb_build_object('Content-Type','application/json'),
          body := jsonb_build_object(
            'content', case when nullif(v_role_id, '') is not null then '<@&' || v_role_id || '> Recruitment status update.' else 'Recruitment status update.' end,
            'allowed_mentions', case when nullif(v_role_id, '') is not null then jsonb_build_object('roles', jsonb_build_array(v_role_id)) else jsonb_build_object('parse', jsonb_build_array()) end,
            'embeds', jsonb_build_array(jsonb_build_object(
              'title', 'LSCSO Recruitment · ' || v_status_label,
              'description', v_label || ' · ' || new.full_name,
              'fields', jsonb_build_array(
                jsonb_build_object('name','Previous','value',old.status,'inline',true),
                jsonb_build_object('name','Current','value',v_status_label,'inline',true)
              ),
              'timestamp', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
            ))
          )
        );
      end if;
    exception when others then
      null;
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists recruitment_status_change_discord on public.recruitment_applications;
create trigger recruitment_status_change_discord
after update of status on public.recruitment_applications
for each row execute function app_private.notify_recruitment_status_change();
