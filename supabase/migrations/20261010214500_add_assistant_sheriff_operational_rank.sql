-- Assistant Sheriff: Sheriff > Undersheriff > Assistant Sheriff > Major.
-- Command access, not unrestricted Executive authority.
alter table public.personnel_profiles drop constraint if exists personnel_profiles_rank_check;
alter table public.personnel_profiles add constraint personnel_profiles_rank_check check (
 rank=any(array['Sheriff','Undersheriff','Assistant Sheriff','Major','DPT. Attourney','DPT. Associate','Captain','1st Lieutenant','Lieutenant','Sergeant','Corporal','Master Deputy','Deputy III','Deputy II','Deputy','Recruit','Department Attorney','Forensics Specialist'])
);
alter table public.fivem_personnel_sync_actions drop constraint if exists fivem_personnel_sync_actions_desired_rank_check;
alter table public.fivem_personnel_sync_actions add constraint fivem_personnel_sync_actions_desired_rank_check check (
 desired_rank=any(array['Sheriff','Undersheriff','Assistant Sheriff','Major','DPT. Attourney','DPT. Associate','Captain','1st Lieutenant','Lieutenant','Sergeant','Corporal','Master Deputy','Deputy III','Deputy II','Deputy','Recruit'])
);
create or replace function app_private.rank_level(p_rank text)
returns integer language sql immutable set search_path to ''
as $fn$ select case p_rank
 when 'Sheriff' then 130 when 'Undersheriff' then 120
 when 'Assistant Sheriff' then 115 when 'Major' then 110
 when 'Captain' then 100 when '1st Lieutenant' then 90
 when 'Lieutenant' then 80 when 'Sergeant' then 70
 when 'Corporal' then 60 when 'Master Deputy' then 50
 when 'Deputy III' then 40 when 'Deputy II' then 30
 when 'Deputy' then 20 when 'Forensics Specialist' then 15
 when 'Department Attorney' then 15 when 'Recruit' then 10
 else null end $fn$;
create or replace function app_private.rank_access_tier(p_rank text)
returns text language sql immutable set search_path to ''
as $fn$ select case p_rank
 when 'Sheriff' then 'Executive' when 'Undersheriff' then 'Executive'
 when 'Assistant Sheriff' then 'Command' when 'Major' then 'Command'
 when 'DPT. Attourney' then 'Attorney' when 'DPT. Associate' then 'Attorney'
 when 'Department Attorney' then 'Attorney' when 'Captain' then 'Command'
 when '1st Lieutenant' then 'Command' when 'Lieutenant' then 'Supervisor'
 when 'Sergeant' then 'Supervisor' when 'Corporal' then 'Supervisor'
 when 'Master Deputy' then 'Deputy' when 'Deputy III' then 'Deputy'
 when 'Deputy II' then 'Deputy' when 'Deputy' then 'Deputy'
 when 'Recruit' then 'Deputy' when 'Forensics Specialist' then 'Deputy'
 else null end $fn$;
-- Apply the new senior command rank wherever the established Major+ gates apply.
-- Two-rank Sheriff/Undersheriff protections intentionally remain unchanged.
do $rank$ declare f record; definition text; revised text; begin
 for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where p.prokind='f' and n.nspname in ('public','app_private')
  and p.proname not in ('rank_level','rank_access_tier')
  and pg_get_functiondef(p.oid) like '%''Undersheriff'',''Major''%'
 loop
  definition:=pg_get_functiondef(f.oid);
  revised:=replace(definition,'''Undersheriff'',''Major''',
    '''Undersheriff'',''Assistant Sheriff'',''Major''');
  if f.proname in ('roster_update_personnel_rank_status','v2_update_personnel_identity') then
   revised:=replace(revised,'if v_actor_rank=''Major'' and',
     'if v_actor_rank=''Assistant Sheriff'' and (v_old_level>=app_private.rank_level(''Assistant Sheriff'') or v_new_level>=app_private.rank_level(''Assistant Sheriff'')) then raise exception ''Assistant Sheriff may change ranks below Assistant Sheriff only''; end if;'||chr(10)||'  if v_actor_rank=''Major'' and');
  end if;
  if revised<>definition then execute revised; end if;
 end loop;
end $rank$;
-- An in-game grade cannot safely be assigned until the FiveM job grade table is updated.
