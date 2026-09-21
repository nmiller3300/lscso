begin;
create temporary table mobile_test_context as
select a.id author_id,a.auth_user_id author_auth,b.id subject_id,b.auth_user_id subject_auth,gen_random_uuid() record_id
from public.personnel_profiles a cross join public.personnel_profiles b
where a.is_test_account and b.is_test_account and a.rank='Sergeant' and b.rank='Deputy' and a.status='Active' and b.status='Active' limit 1;
grant select on mobile_test_context to authenticated;
insert into public.supervisory_authorities(supervisor_profile_id,subject_profile_id,authority_type,reason)
select author_id,subject_id,'Primary','Rolled-back mobile integration verification' from mobile_test_context on conflict do nothing;
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',author_auth)::text,true) from mobile_test_context;
set local role authenticated;
insert into public.guardian_records(id,guardian_number,subject_profile_id,record_type,status,title,incident_at,observed_behavior,points_assessed)
overriding system value
select record_id,900000000,subject_id,'Feedback','Draft','Mobile regression test',now(),'Factual narrative used only by the rolled-back integration test.',0 from mobile_test_context;
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',subject_auth)::text,true) from mobile_test_context;
do $$
declare c record; blocked boolean:=false;
begin
  select * into c from mobile_test_context;
  if exists(select 1 from public.guardian_records where id=c.record_id) then raise exception 'Deputy could see an unissued draft'; end if;
  begin perform public.mobile_save_guardian_draft(c.record_id,'{}'::jsonb); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Deputy could edit another author draft'; end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',author_auth)::text,true) from mobile_test_context;
do $$
declare c record; result public.guardian_records; payload jsonb;
begin
  select * into c from mobile_test_context;
  payload:=jsonb_build_object('subject_profile_id',c.subject_id,'record_type','Feedback','status','Awaiting Acknowledgment','title','Mobile regression test','incident_at',now(),'observed_behavior','Factual narrative used only by the rolled-back integration test.','points_assessed',0);
  result:=public.mobile_save_guardian_draft(c.record_id,payload);
  if result.status<>'Awaiting Acknowledgment' or result.guardian_number<>900000000 then raise exception 'Draft issue did not preserve status/number'; end if;
  result:=public.mobile_save_guardian_draft(c.record_id,payload);
  if result.guardian_number<>900000000 then raise exception 'Retry changed Guardian number'; end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',subject_auth)::text,true) from mobile_test_context;
do $$
declare c record; name text;
begin
  select * into c from mobile_test_context;
  if not exists(select 1 from public.guardian_records where id=c.record_id) then raise exception 'Issued Guardian not visible to subject'; end if;
  select display_name into name from public.personnel_profiles where id=c.subject_id;
  perform public.acknowledge_guardian(c.record_id,name,'Test acknowledgment; transaction will be rolled back.');
  if not exists(select 1 from public.guardian_records where id=c.record_id and acknowledged_at is not null) then raise exception 'Acknowledgment missing'; end if;
end $$;
rollback;
select 'PASS: subject cannot see drafts, cross-author edit denied, draft issue preserves case number, retry idempotent, issued visibility, acknowledgment' as mobile_guardian_tests;
