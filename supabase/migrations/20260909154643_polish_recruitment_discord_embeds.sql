create or replace function app_private.notify_recruitment_application_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_webhook text;
  v_role_id text;
  v_label text := 'APP-' || lpad(new.application_number::text, 4, '0');
  v_review_url text := 'https://lscsogov.vercel.app/portal/command/applications/' || new.id::text;
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
    v_label || ' · ' || new.full_name || ' is waiting for Captain+ review.',
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
          'username', 'LSCSO Recruitment',
          'avatar_url', 'https://lscsogov.vercel.app/images/lscso-portal-patch.webp',
          'content', case when nullif(v_role_id, '') is not null then '<@&' || v_role_id || '>' else null end,
          'allowed_mentions', case when nullif(v_role_id, '') is not null then jsonb_build_object('roles', jsonb_build_array(v_role_id)) else jsonb_build_object('parse', jsonb_build_array()) end,
          'embeds', jsonb_build_array(jsonb_build_object(
            'author', jsonb_build_object('name','LOS SANTOS COUNTY SHERIFF''S OFFICE · RECRUITMENT'),
            'title', v_label || ' · NEW DEPUTY APPLICATION',
            'url', v_review_url,
            'description', '**' || left(new.full_name, 120) || '** submitted a candidate packet for Command review.',
            'color', 13941615,
            'fields', jsonb_build_array(
              jsonb_build_object('name','Discord','value',left(new.discord_username,1024),'inline',true),
              jsonb_build_object('name','Status','value','Submitted','inline',true),
              jsonb_build_object('name','Next action','value','Review the application and record an acceptance or a denial with reason.','inline',false)
            ),
            'footer', jsonb_build_object('text','Captain+ notified in the LSCSO Command Portal · Tap the title to review'),
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
$function$;

create or replace function app_private.notify_recruitment_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_webhook text;
  v_role_id text;
  v_label text := 'APP-' || lpad(new.application_number::text, 4, '0');
  v_title text;
  v_description text;
  v_status text;
  v_next_action text;
  v_color integer;
  v_review_url text := 'https://lscsogov.vercel.app/portal/command/applications/' || new.id::text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'Accepted' then
    v_title := v_label || ' · APPLICATION ACCEPTED';
    v_description := '**' || new.full_name || '** passed the written application screening.';
    v_status := 'Accepted';
    v_next_action := 'Contact the applicant on Discord and schedule the required interview.';
    v_color := 13941615;
  elsif new.status = 'Denied' then
    v_title := v_label || ' · APPLICATION DENIED';
    v_description := '**' || new.full_name || '** was denied during application review.';
    v_status := 'Denied';
    v_next_action := 'Application closed. The documented denial reason remains in the Command record.';
    v_color := 13127746;
  elsif new.status = 'Hired' then
    v_title := v_label || ' · RECRUIT APPOINTED';
    v_description := '**' || new.full_name || '** completed the interview gate and was appointed as an LSCSO Recruit.';
    v_status := 'Hired';
    v_next_action := 'Continue Recruit onboarding, assignment, and training.';
    v_color := 5400190;
  else
    return new;
  end if;

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
          'username', 'LSCSO Recruitment',
          'avatar_url', 'https://lscsogov.vercel.app/images/lscso-portal-patch.webp',
          'content', case when nullif(v_role_id, '') is not null then '<@&' || v_role_id || '>' else null end,
          'allowed_mentions', case when nullif(v_role_id, '') is not null then jsonb_build_object('roles', jsonb_build_array(v_role_id)) else jsonb_build_object('parse', jsonb_build_array()) end,
          'embeds', jsonb_build_array(jsonb_build_object(
            'author', jsonb_build_object('name','LOS SANTOS COUNTY SHERIFF''S OFFICE · RECRUITMENT'),
            'title', v_title,
            'url', v_review_url,
            'description', v_description,
            'color', v_color,
            'fields', jsonb_build_array(
              jsonb_build_object('name','Applicant','value',left(new.full_name,1024),'inline',true),
              jsonb_build_object('name','Status','value',v_status,'inline',true),
              jsonb_build_object('name','Next action','value',v_next_action,'inline',false)
            ),
            'footer', jsonb_build_object('text','LSCSO Recruitment Workflow · Tap the title to open the Command record'),
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
$function$;
