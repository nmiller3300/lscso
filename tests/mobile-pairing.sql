-- Transactional regression test: only test accounts; all mutations rolled back.
begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
do $$
declare a uuid; b uuid; expiry timestamptz; result jsonb; blocked boolean; hash text:=repeat('a',64);
begin
  select id into a from public.personnel_profiles where is_test_account and status='Active' order by id limit 1;
  select id into b from public.personnel_profiles where is_test_account and status='Active' and id<>a limit 1;
  if a is null or b is null then raise exception 'Need two active test personnel accounts'; end if;
  perform public.mobile_disconnect_character(a);
  perform public.mobile_disconnect_character(b);
  expiry:=public.mobile_create_pairing(a,hash);
  if expiry<=now() then raise exception 'Expiry is not in the future'; end if;
  result:=public.mobile_redeem_pairing(hash,'LSCSO-MOBILE-REGRESSION','license:mobile-regression',6);
  if result->>'citizenId'<>'LSCSO-MOBILE-REGRESSION' then raise exception 'Link returned wrong character'; end if;
  blocked:=false;
  begin perform public.mobile_redeem_pairing(hash,'LSCSO-MOBILE-REGRESSION','license:mobile-regression',6); exception when others then blocked:=true; end;
  if not blocked then raise exception 'Consumed code was reusable'; end if;
  blocked:=false;
  begin perform public.mobile_link_character(a,'LSCSO-MOBILE-REGRESSION','license:wrong-license',6); exception when others then blocked:=true; end;
  if not blocked then raise exception 'Wrong license replaced an active link'; end if;
  perform public.mobile_create_pairing(b,repeat('b',64));
  blocked:=false;
  begin perform public.mobile_redeem_pairing(repeat('b',64),'LSCSO-MOBILE-REGRESSION','license:mobile-regression',6); exception when others then blocked:=true; end;
  if not blocked then raise exception 'Character was stolen from another account'; end if;
  if not exists(select 1 from public.fivem_pairing_codes where code_hash=repeat('b',64) and consumed_at is null) then raise exception 'Failed link consumed code'; end if;
  perform public.mobile_disconnect_character(a);
  perform public.mobile_redeem_pairing(repeat('b',64),'LSCSO-MOBILE-REGRESSION','license:mobile-regression',1);
  if not exists(select 1 from public.fivem_identity_links where citizen_id='LSCSO-MOBILE-REGRESSION' and personnel_profile_id=b and active) then raise exception 'Reconnect failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
set local role authenticated;
do $$
declare blocked boolean:=false;
begin
  begin perform public.mobile_redeem_pairing(repeat('a',64),'LSCSO-MOBILE-REGRESSION','license:mobile-regression',6); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Browser role could redeem pairing'; end if;
end $$;
rollback;
select 'PASS: atomic redemption, consumed code rejection, license match, account conflicts, rollback on failure, reconnect, browser access denial' as mobile_pairing_tests;
