-- REVIEW ONLY / NOT APPLIED. Independent upgrade; existing Studio v1 data is untouched.
begin;
create table public.velori_forge_wallets (
 user_id uuid primary key references auth.users(id) on delete cascade,
 day_start timestamptz not null default date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',
 daily_used integer not null default 0 check(daily_used between 0 and 1000),
 pro_start timestamptz, pro_end timestamptz, pro_used integer not null default 0 check(pro_used between 0 and 50000),
 subscription_id text, subscription_status text not null default 'none' check(subscription_status in ('none','active','past_due','canceled','unpaid')),
 topup bigint not null default 0 check(topup between -1000000000 and 1000000000),
 account_locked boolean not null default false, updated_at timestamptz not null default now(),
 check((pro_start is null and pro_end is null) or (pro_start is not null and pro_end>pro_start))
);
create table public.velori_forge_requests (
 user_id uuid not null references auth.users(id) on delete cascade, request_id uuid not null,
 source text not null check(source in ('daily','pro','topup')), period_start timestamptz,
 state text not null default 'reserved' check(state in ('reserved','complete','failed')),
 result jsonb, started_at timestamptz not null default clock_timestamp(), finished_at timestamptz,
 primary key(user_id,request_id), check(result is null or octet_length(result::text)<=4000000)
);
create index velori_forge_request_pending on public.velori_forge_requests(user_id,started_at) where state='reserved';
create index velori_forge_request_capacity on public.velori_forge_requests(started_at);
create table public.velori_forge_orders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null, sku text not null check(sku in ('PRO_MONTHLY','TOPUP5000')),
 provider text not null check(provider in ('stripe','razorpay')), price_id text not null,
 currency text not null check(currency in ('inr','usd')), amount integer not null,
 provider_order_id text, subscription_id text, livemode boolean not null default false,
 status text not null default 'pending' check(status in ('pending','paid','failed','refunded')),
 created_at timestamptz not null default now(), unique(user_id,request_id), unique(provider,provider_order_id),
 check(amount=case when sku='PRO_MONTHLY' then case when currency='inr' then 99900 else 1200 end else case when currency='inr' then 24900 else 300 end end),
 check(provider<>'razorpay' or (sku='TOPUP5000' and currency='inr'))
);
create index velori_forge_orders_owner on public.velori_forge_orders(user_id,created_at desc);
create table public.velori_forge_settlements (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.velori_forge_orders(id),
 provider text not null, transaction_id text not null, event_id text not null,
 period_start timestamptz, period_end timestamptz, reversed_at timestamptz,
 created_at timestamptz not null default now(), unique(provider,transaction_id), unique(provider,event_id)
);
create table public.velori_forge_receipts (
 id uuid primary key default gen_random_uuid(), settlement_id uuid not null unique references public.velori_forge_settlements(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 state text not null default 'pending' check(state in ('pending','sending','sent','failed')),
 attempts integer not null default 0 check(attempts>=0), retry_at timestamptz not null default now(),
 claimed_at timestamptz, sent_at timestamptz, provider_message_id text
);
create index velori_forge_receipt_pending on public.velori_forge_receipts(retry_at) where state in ('pending','failed');
alter table public.velori_forge_wallets enable row level security;
alter table public.velori_forge_requests enable row level security;
alter table public.velori_forge_orders enable row level security;
alter table public.velori_forge_settlements enable row level security;
alter table public.velori_forge_receipts enable row level security;
revoke all on public.velori_forge_wallets,public.velori_forge_requests,public.velori_forge_orders,public.velori_forge_settlements,public.velori_forge_receipts from public,anon,authenticated;
grant all on public.velori_forge_wallets,public.velori_forge_requests,public.velori_forge_orders,public.velori_forge_settlements,public.velori_forge_receipts to service_role;
grant select on public.velori_forge_wallets,public.velori_forge_orders to authenticated;
create policy forge_wallet_owner on public.velori_forge_wallets for select to authenticated using((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
create policy forge_order_owner on public.velori_forge_orders for select to authenticated using((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));

create function public.velori_forge_balance(p_user uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.velori_forge_wallets%rowtype; r public.velori_forge_requests%rowtype; d timestamptz:=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC'; pro boolean;
begin
 insert into public.velori_forge_wallets(user_id) values(p_user) on conflict do nothing;
 select * into w from public.velori_forge_wallets where user_id=p_user for update;
 -- Refund abandoned reservations once, only to the period that originally paid.
 for r in update public.velori_forge_requests set state='failed',finished_at=clock_timestamp() where user_id=p_user and state='reserved' and started_at<clock_timestamp()-interval '2 minutes' returning * loop
  if r.source='topup' then w.topup:=w.topup+1;
  elsif r.source='daily' and r.period_start=w.day_start then w.daily_used:=greatest(0,w.daily_used-1);
  elsif r.source='pro' and r.period_start=w.pro_start then w.pro_used:=greatest(0,w.pro_used-1); end if;
 end loop;
 if w.day_start<>d then w.day_start:=d; w.daily_used:=0; end if;
 update public.velori_forge_wallets set topup=w.topup,daily_used=w.daily_used,pro_used=w.pro_used,day_start=w.day_start where user_id=p_user;
 pro:=w.pro_start<=clock_timestamp() and w.pro_end>clock_timestamp();
 return jsonb_build_object('model','hybrid-v2','plan',case when coalesce(pro,false) then 'PRO' else 'FREE' end,
  'used',case when coalesce(pro,false) then w.pro_used else w.daily_used end,'limit',case when coalesce(pro,false) then 50000 else 1000 end,
  'topup',greatest(0,w.topup),'periodStart',case when coalesce(pro,false) then w.pro_start else w.day_start end,
  'periodEnd',case when coalesce(pro,false) then w.pro_end else w.day_start+interval '1 day' end,'accountLocked',w.account_locked);
end $$;
create function public.velori_forge_reserve(p_user uuid,p_request uuid,p_daily_cap integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare q jsonb; w public.velori_forge_wallets%rowtype; r public.velori_forge_requests%rowtype; src text; stamp timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(240255001);
 q:=public.velori_forge_balance(p_user);
 select * into w from public.velori_forge_wallets where user_id=p_user for update;
 select * into r from public.velori_forge_requests where user_id=p_user and request_id=p_request;
 if found then return jsonb_build_object('state',r.state,'result',r.result,'quota',q); end if;
 if w.account_locked then return jsonb_build_object('state','account_locked','quota',q); end if;
 if exists(select 1 from public.velori_forge_requests where user_id=p_user and state='reserved') then return jsonb_build_object('state','busy'); end if;
 if p_daily_cap is null or p_daily_cap not between 1 and 1000000 or
  (select count(*) from public.velori_forge_requests where started_at>=w.day_start)>=p_daily_cap then return jsonb_build_object('state','capacity'); end if;
 if (q->>'used')::int<(q->>'limit')::int then
  if q->>'plan'='PRO' then src:='pro'; stamp:=w.pro_start; update public.velori_forge_wallets set pro_used=pro_used+1 where user_id=p_user;
  else src:='daily'; stamp:=w.day_start; update public.velori_forge_wallets set daily_used=daily_used+1 where user_id=p_user; end if;
 elsif w.topup>0 then src:='topup'; update public.velori_forge_wallets set topup=topup-1 where user_id=p_user;
 else return jsonb_build_object('state','quota_exhausted','quota',q); end if;
 insert into public.velori_forge_requests(user_id,request_id,source,period_start) values(p_user,p_request,src,stamp);
 return jsonb_build_object('state','reserved','source',src);
end $$;
create function public.velori_forge_finish(p_user uuid,p_request uuid,p_result jsonb) returns boolean language plpgsql security invoker set search_path='' as $$
declare r public.velori_forge_requests%rowtype;
begin
 perform 1 from public.velori_forge_wallets where user_id=p_user for update;
 select * into r from public.velori_forge_requests where user_id=p_user and request_id=p_request for update;
 if not found then return false; end if;
 if r.state='complete' then return p_result is not null; elsif r.state='failed' then return p_result is null; end if;
 update public.velori_forge_requests set state=case when p_result is null then 'failed' else 'complete' end,result=p_result,finished_at=clock_timestamp() where user_id=p_user and request_id=p_request;
 if p_result is null then update public.velori_forge_wallets set
  daily_used=greatest(0,daily_used-case when r.source='daily' and day_start=r.period_start then 1 else 0 end),
  pro_used=greatest(0,pro_used-case when r.source='pro' and pro_start=r.period_start then 1 else 0 end),
  topup=topup+case when r.source='topup' then 1 else 0 end where user_id=p_user; end if;
 return true;
end $$;
-- Only a verified provider adapter may call settlement. No direct client token increment RPC exists.
create function public.velori_forge_settle(p_order uuid,p_event text,p_transaction text,p_amount integer,p_currency text,p_period_start timestamptz,p_period_end timestamptz,p_subscription text) returns boolean language plpgsql security invoker set search_path='' as $$
declare o public.velori_forge_orders%rowtype; s public.velori_forge_settlements%rowtype; w public.velori_forge_wallets%rowtype; sid uuid;
begin
 select * into o from public.velori_forge_orders where id=p_order for update;
 if not found or p_transaction is null or p_event is null or p_amount<>o.amount or p_currency<>o.currency then return false; end if;
 select * into s from public.velori_forge_settlements where provider=o.provider and transaction_id=p_transaction;
 if found then return s.order_id=o.id; end if;
 if exists(select 1 from public.velori_forge_settlements where provider=o.provider and event_id=p_event) then return false; end if;
 perform public.velori_forge_balance(o.user_id);
 select * into w from public.velori_forge_wallets where user_id=o.user_id for update;
 if o.sku='TOPUP5000' then
  if o.status<>'pending' then return false; end if;
  update public.velori_forge_wallets set topup=topup+5000 where user_id=o.user_id;
 else
  if o.provider<>'stripe' or p_subscription is null or p_period_start is null or p_period_end is null or p_period_end<=p_period_start or p_period_end<=clock_timestamp() then return false; end if;
  if w.subscription_id is not null and w.subscription_id<>p_subscription and w.pro_end>clock_timestamp() then return false; end if;
  if w.pro_start is null or p_period_start>w.pro_start then
   update public.velori_forge_wallets set pro_start=p_period_start,pro_end=p_period_end,pro_used=0,subscription_id=p_subscription,subscription_status='active' where user_id=o.user_id;
  elsif p_period_start=w.pro_start and p_period_end=w.pro_end then null;
  else return false; end if;
 end if;
 insert into public.velori_forge_settlements(order_id,provider,transaction_id,event_id,period_start,period_end) values(o.id,o.provider,p_transaction,p_event,p_period_start,p_period_end) returning id into sid;
 update public.velori_forge_orders set status='paid',subscription_id=p_subscription where id=o.id;
 insert into public.velori_forge_receipts(settlement_id,user_id) values(sid,o.user_id);
 -- account_locked is deliberately not cleared by a purchase.
 return true;
end $$;
revoke all on function public.velori_forge_balance(uuid),public.velori_forge_reserve(uuid,uuid,integer),public.velori_forge_finish(uuid,uuid,jsonb),public.velori_forge_settle(uuid,text,text,integer,text,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.velori_forge_balance(uuid),public.velori_forge_reserve(uuid,uuid,integer),public.velori_forge_finish(uuid,uuid,jsonb),public.velori_forge_settle(uuid,text,text,integer,text,timestamptz,timestamptz,text) to service_role;
commit;
