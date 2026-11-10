-- Copyright © 2026 VELORYZ. All rights reserved.
-- STAGING PROPOSAL ONLY. Apply after reviewing the latest deployed V33 RPC definitions.
-- Verified recurring Stripe subscriptions; no client can directly grant entitlements.
-- Existing one-time Premium orders retain permanent account.plan semantics.
begin;
create table if not exists public.velori_studio_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  checkout_session_id text unique,
  checkout_started_at timestamptz,
  customer_id text,
  subscription_id text unique,
  stripe_price_id text not null,
  status text not null default 'pending' check (status in ('pending','incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (checkout_session_id is null or checkout_session_id ~ '^cs_[A-Za-z0-9]+$'),
  check (customer_id is null or customer_id ~ '^cus_[A-Za-z0-9]+$'),
  check (subscription_id is null or subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  check (stripe_price_id ~ '^price_[A-Za-z0-9]+$')
);
alter table public.velori_studio_subscriptions enable row level security;
revoke all on public.velori_studio_subscriptions from public,anon,authenticated;
grant all on public.velori_studio_subscriptions to service_role;
grant select on public.velori_studio_subscriptions to authenticated;
create policy studio_subscription_owner on public.velori_studio_subscriptions
  for select to authenticated
  using (user_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));

-- Effective Premium = one-time purchase OR a verified, unexpired monthly subscription.
-- No trigger or client mutation of the paid plan. Existing one-time ownership is preserved.
create or replace function public.velori_studio_account(p_user uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.velori_studio_accounts%rowtype; pro boolean;
begin
 insert into public.velori_studio_accounts(user_id) values(p_user) on conflict do nothing;
 perform public.velori_studio_cleanup(p_user);
 select * into a from public.velori_studio_accounts where user_id=p_user;
 pro := a.plan='PREMIUM' or exists(
   select 1 from public.velori_studio_subscriptions s where s.user_id=p_user
     and s.status in ('active','trialing') and s.current_period_end>clock_timestamp()
 );
 return jsonb_build_object('plan',case when pro then 'PREMIUM' else 'FREE' end,
   'freeLeft',a.free_left,'tokens',greatest(0,a.tokens),'editorLeft',a.editor_left,
   'canGenerate',pro or a.free_left>0 or a.tokens>0,
   'canEdit',pro or a.editor_left>0 or a.tokens>0);
end $$;

create or replace function public.velori_studio_reserve(p_user uuid,p_request uuid,p_daily_cap integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.velori_studio_accounts%rowtype; r public.velori_studio_requests%rowtype;
 charge text; pro boolean;
begin
 perform pg_catalog.pg_advisory_xact_lock(240242253);
 perform public.velori_studio_account(p_user);
 select * into a from public.velori_studio_accounts where user_id=p_user for update;
 pro := a.plan='PREMIUM' or exists (
   select 1 from public.velori_studio_subscriptions s where s.user_id=p_user
     and s.status in ('active','trialing') and s.current_period_end>clock_timestamp()
 );
 select * into r from public.velori_studio_requests where user_id=p_user and request_id=p_request;
 if found then return jsonb_build_object('state',case when r.kind<>'generate' then 'conflict' when r.state='reserved' then 'running' else r.state end,'result',r.result); end if;
 if exists(select 1 from public.velori_studio_requests where user_id=p_user and state='reserved') then return jsonb_build_object('state','busy'); end if;
 if (select count(*) from public.velori_studio_requests where user_id=p_user and kind='generate' and started_at>clock_timestamp()-interval '1 hour') >= (case when pro then 60 else 10 end) then return jsonb_build_object('state','rate'); end if;
 if p_daily_cap not between 1 and 10000 or (select count(*) from public.velori_studio_requests where kind='generate' and started_at>=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC')>=p_daily_cap then return jsonb_build_object('state','capacity'); end if;
 if pro then charge:='premium';
 elsif a.free_left>0 then charge:='free';update public.velori_studio_accounts set free_left=free_left-1 where user_id=p_user;
 elsif a.tokens>0 then charge:='token';update public.velori_studio_accounts set tokens=tokens-1 where user_id=p_user;
 else return jsonb_build_object('state','quota'); end if;
 insert into public.velori_studio_requests(user_id,request_id,kind,state,source) values(p_user,p_request,'generate','reserved',charge);
 return jsonb_build_object('state','reserved','plan',case when pro then 'PREMIUM' else 'FREE' end);
end $$;

revoke all on function public.velori_studio_account(uuid),public.velori_studio_reserve(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.velori_studio_account(uuid),public.velori_studio_reserve(uuid,uuid,integer) to service_role;
commit;
