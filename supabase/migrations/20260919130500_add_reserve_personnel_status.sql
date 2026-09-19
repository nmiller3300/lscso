alter table public.personnel_profiles
  drop constraint if exists personnel_profiles_status_check;

alter table public.personnel_profiles
  add constraint personnel_profiles_status_check
  check (status = any (array['Active'::text,'Acting'::text,'Reserve'::text,'Suspended'::text,'Deactivated'::text]));

do $block$
declare
  v_name text;
  v_def text;
begin
  foreach v_name in array array['current_profile_id','current_access_tier','current_is_executive'] loop
    select pg_get_functiondef(p.oid)
      into v_def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_private'
      and p.proname = v_name
      and pg_get_function_identity_arguments(p.oid) = '';

    if v_def is not null then
      v_def := replace(v_def, $$status in ('Active','Acting')$$, $$status in ('Active','Acting','Reserve')$$);
      execute v_def;
    end if;
  end loop;
end
$block$;

do $block$
declare
  v_def text;
begin
  select pg_get_functiondef('public.roster_update_personnel_rank_status(uuid,text,text,text)'::regprocedure)
    into v_def;

  v_def := replace(
    v_def,
    $$p_status not in ('Active','Acting','Suspended')$$,
    $$p_status not in ('Active','Acting','Reserve','Suspended')$$
  );

  v_def := replace(
    v_def,
    $$values(p_profile_id,v_citizen_id,p_rank,v_grade,p_status,v_reason,v_actor);$$,
    $$values(p_profile_id,v_citizen_id,p_rank,v_grade,case when p_status='Reserve' then 'Active' else p_status end,v_reason,v_actor);$$
  );

  execute v_def;
end
$block$;

do $block$
declare
  v_name text;
  v_def text;
begin
  foreach v_name in array array['get_public_roster','get_public_roster_v2'] loop
    select pg_get_functiondef(p.oid)
      into v_def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = v_name
      and pg_get_function_identity_arguments(p.oid) = '';

    if v_def is not null then
      v_def := replace(
        v_def,
        $$when p.status in ('Active','Acting') then 'Active'$$,
        $$when p.status='Reserve' then 'Reserve'
      when p.status in ('Active','Acting') then 'Active'$$
      );
      execute v_def;
    end if;
  end loop;
end
$block$;

do $block$
declare
  v_def text;
begin
  select pg_get_functiondef('public.get_roster_management_snapshot()'::regprocedure)
    into v_def;

  v_def := replace(
    v_def,
    $$when p.status in ('Active','Acting') then p.status$$,
    $$when p.status='Reserve' then 'Reserve' when p.status in ('Active','Acting') then p.status$$
  );

  execute v_def;
end
$block$;
