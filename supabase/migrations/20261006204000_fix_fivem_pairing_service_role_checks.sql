-- Fix FiveM pairing RPCs for Supabase server secret keys.
-- These RPCs are executable only by service_role, so explicit auth.jwt() role
-- checks are redundant and break with newer server secret key transports that
-- do not populate auth.jwt() the same way as legacy JWT service-role keys.

create or replace function public.mobile_create_pairing(p_profile_id uuid, p_code_hash text)
returns timestamptz
language plpgsql
set search_path to ''
as $function$
declare expiration timestamptz := now() + interval '10 minutes';
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('lscso-pairing-v2'));
  if not exists(select 1 from public.personnel_profiles where id=p_profile_id and status in ('Active','Acting')) then
    raise exception 'Active account required';
  end if;
  if exists(select 1 from public.fivem_identity_links where personnel_profile_id=p_profile_id and active) then
    raise exception 'Account already connected. Refresh connection status.';
  end if;
  delete from public.fivem_pairing_codes where personnel_profile_id=p_profile_id and consumed_at is null;
  delete from public.fivem_pairing_codes where expires_at < now()-interval '1 day';
  insert into public.fivem_pairing_codes(personnel_profile_id,code_hash,expires_at)
  values(p_profile_id,p_code_hash,expiration);
  return expiration;
end
$function$;
revoke all on function public.mobile_create_pairing(uuid,text) from public,anon,authenticated;
grant execute on function public.mobile_create_pairing(uuid,text) to service_role;

create or replace function public.mobile_link_character(p_profile_id uuid,p_citizen_id text,p_license text,p_grade integer)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare p public.personnel_profiles; existing public.fivem_identity_links; other_link public.fivem_identity_links;
begin
  if length(p_citizen_id) not between 2 and 100 or length(p_license) not between 2 and 160 or p_grade not between 0 and 12 or p_grade is null then
    raise exception 'Invalid character identity';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('lscso-pairing-v2'));
  select * into p from public.personnel_profiles where id=p_profile_id for update;
  if p.id is null or p.status not in ('Active','Acting') then raise exception 'Personnel account is not active'; end if;
  select * into existing from public.fivem_identity_links where citizen_id=p_citizen_id for update;
  select * into other_link from public.fivem_identity_links where personnel_profile_id=p_profile_id and active for update;
  if other_link.id is not null and other_link.citizen_id <> p_citizen_id then
    raise exception 'This account is already linked to another character. Disconnect it on the website first.';
  end if;
  if existing.id is not null and existing.active and existing.personnel_profile_id <> p_profile_id then
    raise exception 'This character is already linked to another account';
  end if;
  if existing.id is not null and existing.active and existing.license_identifier is not null and existing.license_identifier <> p_license then
    raise exception 'Character license does not match the linked account';
  end if;
  insert into public.fivem_identity_links(personnel_profile_id,citizen_id,license_identifier,active,linked_by,last_seen_grade,last_seen_at)
  values(p_profile_id,p_citizen_id,p_license,true,p_profile_id,p_grade,now())
  on conflict(citizen_id) do update
  set personnel_profile_id=excluded.personnel_profile_id,license_identifier=excluded.license_identifier,active=true,
      linked_by=excluded.linked_by,last_seen_grade=excluded.last_seen_grade,last_seen_at=now(),linked_at=now(),updated_at=now();
  insert into public.audit_log(actor_profile_id,action,table_name,record_id,new_data)
  values(p_profile_id,'FIVEM_CHARACTER_LINKED','fivem_identity_links',p_citizen_id,jsonb_build_object('citizen_id',p_citizen_id));
  return jsonb_build_object('personnelId',p.personnel_id,'displayName',p.display_name,'personnelRank',p.rank,'citizenId',p_citizen_id);
end
$function$;
revoke all on function public.mobile_link_character(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.mobile_link_character(uuid,text,text,integer) to service_role;

create or replace function public.mobile_redeem_pairing(p_code_hash text,p_citizen_id text,p_license text,p_grade integer)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare c public.fivem_pairing_codes; result jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('lscso-pairing-v2'));
  select * into c from public.fivem_pairing_codes
  where code_hash=p_code_hash and consumed_at is null and expires_at>now()
  for update;
  if c.id is null then raise exception 'That pairing code is invalid or expired'; end if;
  result:=public.mobile_link_character(c.personnel_profile_id,p_citizen_id,p_license,p_grade);
  update public.fivem_pairing_codes set consumed_at=now() where id=c.id;
  return result;
end
$function$;
revoke all on function public.mobile_redeem_pairing(text,text,text,integer) from public,anon,authenticated;
grant execute on function public.mobile_redeem_pairing(text,text,text,integer) to service_role;

create or replace function public.mobile_disconnect_character(p_profile_id uuid)
returns void
language plpgsql
set search_path to ''
as $function$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('lscso-pairing-v2'));
  update public.fivem_identity_links set active=false,updated_at=now()
  where personnel_profile_id=p_profile_id and active;
  delete from public.fivem_pairing_codes where personnel_profile_id=p_profile_id;
  insert into public.audit_log(actor_profile_id,action,table_name,record_id)
  values(p_profile_id,'FIVEM_CHARACTER_DISCONNECTED','personnel_profiles',p_profile_id::text);
end
$function$;
revoke all on function public.mobile_disconnect_character(uuid) from public,anon,authenticated;
grant execute on function public.mobile_disconnect_character(uuid) to service_role;
