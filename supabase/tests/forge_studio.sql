-- Transactional acceptance: references two existing users, leaves no fixture changes.
begin;
do $$
declare u uuid; v uuid; p uuid:=gen_random_uuid(); r uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); q jsonb; a jsonb; stamp timestamptz; o jsonb;
 payload jsonb:='{"format":"velori-sealed-v1","nonce":"AAAAAAAAAAAAAAAA","ciphertext":"AAAAAAAAAAAAAAAAAAAAAAAA"}';
begin
 select id into u from auth.users where not coalesce(is_anonymous,false) order by id limit 1;
 select id into v from auth.users where not coalesce(is_anonymous,false) and id<>u order by id limit 1;
 if u is null or v is null then raise exception 'Two existing real accounts are required'; end if;
 if exists(select 1 from public.velori_studio_accounts where user_id in(u,v)) then raise exception 'Choose unused Studio fixture accounts'; end if;
 perform set_config('velori.qa_owner',u::text,true); perform set_config('velori.qa_other',v::text,true); perform set_config('velori.qa_project',p::text,true);
 a:=public.velori_studio_account(u); if (a->>'freeLeft')::int<>10 then raise exception 'initial allowance'; end if;
 q:=public.velori_studio_reserve(u,r,10000); if q->>'state'<>'reserved' then raise exception 'reserve'; end if;
 q:=public.velori_studio_reserve(u,r,10000); if q->>'state'<>'running' then raise exception 'duplicate reserve'; end if;
 a:=public.velori_studio_account(u); if (a->>'freeLeft')::int<>9 then raise exception 'duplicate deduction'; end if;
 perform public.velori_studio_finish_local(u,r,false); perform public.velori_studio_finish_local(u,r,false);
 if (select state<>'failed' or result is not null from public.velori_studio_requests where user_id=u and request_id=r) then raise exception 'local receipt stores generated source'; end if;
 a:=public.velori_studio_account(u); if (a->>'freeLeft')::int<>10 then raise exception 'refund idempotence'; end if;
 r:=gen_random_uuid(); perform public.velori_studio_reserve(u,r,10000);
 update public.velori_studio_requests set started_at=clock_timestamp()-interval '3 minutes' where user_id=u and request_id=r;
 a:=public.velori_studio_account(u); if (a->>'freeLeft')::int<>10 then raise exception 'abandoned refund'; end if;
 q:=public.velori_studio_save(u,s,p,'Forge QA',payload,null); if q->>'state'<>'complete' then raise exception 'save'; end if; stamp:=(q->>'updatedAt')::timestamptz;
 q:=public.velori_studio_save(u,s,p,'Forge QA',payload,null); a:=public.velori_studio_account(u); if q->>'state'<>'complete' or (a->>'editorLeft')::int<>49 then raise exception 'save idempotence'; end if;
 q:=public.velori_studio_save(u,gen_random_uuid(),p,'Forge QA',payload,stamp-interval '1 second'); if q->>'state'<>'conflict' then raise exception 'save conflict'; end if;
 q:=public.velori_studio_save(v,gen_random_uuid(),p,'Forge QA',payload,stamp); if q->>'state'<>'conflict' then raise exception 'outsider save'; end if;
 q:=public.velori_studio_save(u,gen_random_uuid(),p,'Forge QA revised',payload,stamp); a:=public.velori_studio_account(u); if q->>'state'<>'complete' or (a->>'editorLeft')::int<>48 then raise exception 'versioned save'; end if;
 o:=public.velori_studio_order(u,gen_random_uuid(),'PACK100','price_Fixture',100,'usd',false);
 if not public.velori_studio_fulfill('evt_ForgeFixture', (o->>'id')::uuid,'cs_ForgeFixture','pi_ForgeFixture') then raise exception 'fulfill'; end if;
 perform public.velori_studio_fulfill('evt_ForgeFixture', (o->>'id')::uuid,'cs_ForgeFixture','pi_ForgeFixture');
 a:=public.velori_studio_account(u); if (a->>'tokens')::int<>100 then raise exception 'duplicate credit'; end if;
 perform public.velori_studio_revoke_payment('evt_ForgeRefund','pi_ForgeFixture'); perform public.velori_studio_revoke_payment('evt_ForgeRefund','pi_ForgeFixture');
 a:=public.velori_studio_account(u); if (a->>'tokens')::int<>0 then raise exception 'duplicate reversal'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('velori.qa_owner'),'role','authenticated','is_anonymous',false)::text,true);
select set_config('request.jwt.claim.sub',current_setting('velori.qa_owner'),true);
do $$begin
 if (select count(*) from public.velori_studio_projects where id=current_setting('velori.qa_project')::uuid)<>1 then raise exception 'owner cannot read'; end if;
 begin perform public.velori_studio_account(current_setting('velori.qa_owner')::uuid); raise exception 'client RPC was allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('velori.qa_other'),'role','authenticated','is_anonymous',false)::text,true);
select set_config('request.jwt.claim.sub',current_setting('velori.qa_other'),true);
do $$begin if exists(select 1 from public.velori_studio_projects where id=current_setting('velori.qa_project')::uuid) then raise exception 'outsider read'; end if; end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('velori.qa_owner'),'role','authenticated','is_anonymous',true)::text,true);
select set_config('request.jwt.claim.sub',current_setting('velori.qa_owner'),true);
do $$begin if exists(select 1 from public.velori_studio_projects where id=current_setting('velori.qa_project')::uuid) then raise exception 'anonymous account read'; end if; end $$;
set local role anon;
do $$begin
 begin perform 1 from public.velori_studio_projects; raise exception 'anonymous table read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: quota reservations/refunds, save replay/conflicts, billing replay/reversal, owner/outsider/anonymous access' as result;
rollback;
