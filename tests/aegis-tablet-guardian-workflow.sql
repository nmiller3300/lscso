-- Rolled-back regression coverage for AEGIS Guardian workflow.
begin;

create temporary table aegis_guardian_test_context as
select a.id author_id,a.auth_user_id author_auth,b.id subject_id,b.auth_user_id subject_auth,
       gen_random_uuid() warning_id, gen_random_uuid() writeup_id
from public.personnel_profiles a
cross join public.personnel_profiles b
where a.is_test_account and b.is_test_account
  and a.rank='Sergeant' and b.rank='Deputy'
  and a.status='Active' and b.status='Active'
limit 1;

grant select on aegis_guardian_test_context to authenticated;

do $$
begin
  if not exists(select 1 from aegis_guardian_test_context) then
    raise exception 'Need active Sergeant and Deputy test accounts';
  end if;
end $$;

insert into public.supervisory_authorities(supervisor_profile_id,subject_profile_id,authority_type,reason)
select author_id,subject_id,'Primary','Rolled-back AEGIS Guardian integration verification'
from aegis_guardian_test_context
on conflict do nothing;

select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',author_auth)::text,true)
from aegis_guardian_test_context;
set local role authenticated;

insert into public.guardian_records(id,subject_profile_id,record_type,status,title,incident_at,observed_behavior,points_assessed)
select warning_id,subject_id,'Written Warning','Draft','AEGIS warning workflow test',now(),
       'Rolled-back warning narrative for tablet integration verification.',0
from aegis_guardian_test_context;

do $$
declare c record; payload jsonb; result public.guardian_records;
begin
  select * into c from aegis_guardian_test_context;
  payload:=jsonb_build_object(
    'subject_profile_id',c.subject_id,
    'record_type','Written Warning',
    'status','Awaiting Acknowledgment',
    'title','AEGIS warning workflow test',
    'incident_at',now(),
    'observed_behavior','Rolled-back warning narrative for tablet integration verification.',
    'points_assessed',0
  );
  result:=public.mobile_save_guardian_draft(c.warning_id,payload);
  if result.status <> 'Awaiting Acknowledgment' then
    raise exception 'Written Warning did not issue directly';
  end if;
end $$;

insert into public.guardian_records(id,subject_profile_id,record_type,status,title,incident_at,observed_behavior,points_assessed)
select writeup_id,subject_id,'Write-Up','Draft','AEGIS write-up workflow test',now(),
       'Rolled-back write-up narrative for tablet integration verification.',0
from aegis_guardian_test_context;

do $$
declare c record; payload jsonb; blocked boolean:=false;
begin
  select * into c from aegis_guardian_test_context;
  payload:=jsonb_build_object(
    'subject_profile_id',c.subject_id,
    'record_type','Write-Up',
    'status','Awaiting Acknowledgment',
    'title','AEGIS write-up workflow test',
    'incident_at',now(),
    'observed_behavior','Rolled-back write-up narrative for tablet integration verification.',
    'points_assessed',0
  );
  begin
    perform public.mobile_save_guardian_draft(c.writeup_id,payload);
  exception when others then
    blocked:=true;
  end;
  if not blocked then
    raise exception 'Write-Up bypassed Command approval';
  end if;
end $$;

rollback;
select 'PASS: AEGIS Written Warning direct issue and Write-Up Command review' as result;
