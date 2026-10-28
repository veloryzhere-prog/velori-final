-- Applied with explicit user approval. Six isolated Forge tables; independent of ecosystem proposal.
begin;
create function public.velori_studio_valid_payload(p jsonb) returns boolean language sql immutable security invoker set search_path='' as $$
 select coalesce(jsonb_typeof(p)='object' and p->>'format'='velori-sealed-v1' and p->>'nonce' ~ '^[A-Za-z0-9+/]{16}$' and length(p->>'ciphertext') between 24 and 4000000 and p->>'ciphertext' ~ '^[A-Za-z0-9+/]+={0,2}$',false)
$$;
create table public.velori_studio_projects(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,title text not null check(length(title) between 1 and 100),pages jsonb not null check(public.velori_studio_valid_payload(pages)),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id));
create index velori_studio_projects_owner_updated on public.velori_studio_projects(user_id,updated_at desc);
create table public.velori_studio_shares(id uuid primary key default gen_random_uuid(),project_id uuid not null,user_id uuid not null,token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),expires_at timestamptz not null,revoked_at timestamptz,created_at timestamptz not null default now(),foreign key(project_id,user_id) references public.velori_studio_projects(id,user_id) on delete cascade);
create index velori_studio_shares_owner on public.velori_studio_shares(user_id,project_id);
create unique index velori_studio_active_share on public.velori_studio_shares(project_id) where revoked_at is null;
create table public.velori_studio_accounts(user_id uuid primary key references auth.users(id) on delete cascade,plan text not null default 'FREE' check(plan in ('FREE','PREMIUM')),free_left integer not null default 10 check(free_left between 0 and 10),editor_left integer not null default 50 check(editor_left between 0 and 50),tokens integer not null default 0 check(tokens between -1000000 and 1000000),created_at timestamptz not null default now());
create table public.velori_studio_requests(user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,kind text not null check(kind in ('generate','save')),state text not null check(state in ('reserved','complete','failed')),source text check(source in ('free','token','premium','editor')),result jsonb check(result is null or octet_length(result::text)<=4000000),started_at timestamptz not null default now(),finished_at timestamptz,primary key(user_id,request_id));
create index velori_studio_requests_recent on public.velori_studio_requests(started_at) where kind='generate';
create index velori_studio_requests_pending on public.velori_studio_requests(user_id,started_at) where state='reserved';
create table public.velori_studio_orders(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,sku text not null check(sku in ('PACK100','PREMIUM')),price_id text not null check(price_id ~ '^price_[A-Za-z0-9]+$'),amount integer not null check(amount>0),currency text not null check(currency in ('inr','usd')),livemode boolean not null,checkout_id text unique,payment_id text unique,status text not null default 'pending' check(status in ('pending','paid','refunded')),created_at timestamptz not null default now(),paid_at timestamptz,unique(user_id,request_id));
create index velori_studio_orders_owner on public.velori_studio_orders(user_id,created_at desc);
create table public.velori_studio_billing_events(event_id text primary key check(event_id ~ '^evt_[A-Za-z0-9]+$'),order_id uuid not null references public.velori_studio_orders(id) on delete cascade,handled_at timestamptz not null default now());
alter table public.velori_studio_projects enable row level security;
alter table public.velori_studio_shares enable row level security;
alter table public.velori_studio_accounts enable row level security;
alter table public.velori_studio_requests enable row level security;
alter table public.velori_studio_orders enable row level security;
alter table public.velori_studio_billing_events enable row level security;
revoke all on public.velori_studio_projects,public.velori_studio_shares,public.velori_studio_accounts,public.velori_studio_requests,public.velori_studio_orders,public.velori_studio_billing_events from public,anon,authenticated;
grant select on public.velori_studio_projects,public.velori_studio_accounts,public.velori_studio_orders to authenticated;
grant all on public.velori_studio_projects,public.velori_studio_shares,public.velori_studio_accounts,public.velori_studio_requests,public.velori_studio_orders,public.velori_studio_billing_events to service_role;
create policy studio_project_owner on public.velori_studio_projects for select to authenticated using((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
create policy studio_account_owner on public.velori_studio_accounts for select to authenticated using((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
create policy studio_order_owner on public.velori_studio_orders for select to authenticated using((select auth.uid())=user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));

create function public.velori_studio_cleanup(p_user uuid) returns void language plpgsql security invoker set search_path='' as $$
declare f integer; t integer;
begin
 perform 1 from public.velori_studio_accounts where user_id=p_user for update;
 with abandoned as(update public.velori_studio_requests set state='failed',finished_at=clock_timestamp() where user_id=p_user and state='reserved' and started_at<clock_timestamp()-interval '2 minutes' returning source)
 select count(*) filter(where source='free'),count(*) filter(where source='token') into f,t from abandoned;
 update public.velori_studio_accounts set free_left=least(10,free_left+f),tokens=tokens+t where user_id=p_user;
end $$;
create function public.velori_studio_account(p_user uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.velori_studio_accounts%rowtype;
begin
 insert into public.velori_studio_accounts(user_id) values(p_user) on conflict do nothing;
 perform public.velori_studio_cleanup(p_user);
 select * into a from public.velori_studio_accounts where user_id=p_user;
 return jsonb_build_object('plan',a.plan,'freeLeft',a.free_left,'tokens',greatest(0,a.tokens),'editorLeft',a.editor_left,'canGenerate',a.plan='PREMIUM' or a.free_left>0 or a.tokens>0,'canEdit',a.plan='PREMIUM' or a.editor_left>0 or a.tokens>0);
end $$;
create function public.velori_studio_reserve(p_user uuid,p_request uuid,p_daily_cap integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.velori_studio_accounts%rowtype; r public.velori_studio_requests%rowtype; charge text;
begin
 perform pg_catalog.pg_advisory_xact_lock(240242253);
 perform public.velori_studio_account(p_user);
 select * into a from public.velori_studio_accounts where user_id=p_user for update;
 select * into r from public.velori_studio_requests where user_id=p_user and request_id=p_request;
 if found then return jsonb_build_object('state',case when r.kind<>'generate' then 'conflict' when r.state='reserved' then 'running' else r.state end,'result',r.result); end if;
 if exists(select 1 from public.velori_studio_requests where user_id=p_user and state='reserved') then return jsonb_build_object('state','busy'); end if;
 if (select count(*) from public.velori_studio_requests where user_id=p_user and kind='generate' and started_at>clock_timestamp()-interval '1 hour')>=(case when a.plan='PREMIUM' then 60 else 10 end) then return jsonb_build_object('state','rate'); end if;
 if p_daily_cap not between 1 and 10000 or (select count(*) from public.velori_studio_requests where kind='generate' and started_at>=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC')>=p_daily_cap then return jsonb_build_object('state','capacity'); end if;
 if a.plan='PREMIUM' then charge:='premium'; elsif a.free_left>0 then charge:='free'; update public.velori_studio_accounts set free_left=free_left-1 where user_id=p_user; elsif a.tokens>0 then charge:='token'; update public.velori_studio_accounts set tokens=tokens-1 where user_id=p_user; else return jsonb_build_object('state','quota'); end if;
 insert into public.velori_studio_requests(user_id,request_id,kind,state,source) values(p_user,p_request,'generate','reserved',charge);
 return jsonb_build_object('state','reserved','plan',a.plan);
end $$;
create function public.velori_studio_finish(p_user uuid,p_request uuid,p_result jsonb) returns boolean language plpgsql security invoker set search_path='' as $$
declare r public.velori_studio_requests%rowtype;
begin
 perform 1 from public.velori_studio_accounts where user_id=p_user for update;
 select * into r from public.velori_studio_requests where user_id=p_user and request_id=p_request for update;
 if not found or r.kind<>'generate' then return false; end if;
 if r.state='complete' then return p_result is not null; end if; if r.state='failed' then return p_result is null; end if;
 if p_result is not null and (not public.velori_studio_valid_payload(p_result->'pages') or jsonb_typeof(p_result->'title') is distinct from 'string') then raise exception 'invalid generated result'; end if;
 update public.velori_studio_requests set state=case when p_result is null then 'failed' else 'complete' end,result=p_result,finished_at=clock_timestamp() where user_id=p_user and request_id=p_request;
 if p_result is null then update public.velori_studio_accounts set free_left=least(10,free_left+case when r.source='free' then 1 else 0 end),tokens=tokens+case when r.source='token' then 1 else 0 end where user_id=p_user; end if;
 return true;
end $$;
create function public.velori_studio_save(p_user uuid,p_request uuid,p_project uuid,p_title text,p_pages jsonb,p_expected timestamptz) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.velori_studio_accounts%rowtype; r public.velori_studio_requests%rowtype; prior public.velori_studio_projects%rowtype; stamp timestamptz:=clock_timestamp(); result jsonb;
begin
 perform public.velori_studio_account(p_user);
 select * into a from public.velori_studio_accounts where user_id=p_user for update;
 select * into r from public.velori_studio_requests where user_id=p_user and request_id=p_request;
 if found then return case when r.kind='save' then r.result else jsonb_build_object('state','conflict') end; end if;
 if a.plan<>'PREMIUM' and a.editor_left=0 and a.tokens<=0 then return jsonb_build_object('state','locked'); end if;
 select * into prior from public.velori_studio_projects where id=p_project for update;
 if found then
  if prior.user_id<>p_user or p_expected is null or prior.updated_at<>p_expected then return jsonb_build_object('state','conflict'); end if;
  update public.velori_studio_projects set title=p_title,pages=p_pages,updated_at=stamp where id=p_project;
 else
  if (select count(*) from public.velori_studio_projects where user_id=p_user)>=12 then raise exception 'account project limit'; end if;
  insert into public.velori_studio_projects(id,user_id,title,pages,updated_at) values(p_project,p_user,p_title,p_pages,stamp);
 end if;
 if a.plan<>'PREMIUM' and a.tokens<=0 then update public.velori_studio_accounts set editor_left=greatest(0,editor_left-1) where user_id=p_user; end if;
 result:=jsonb_build_object('state','complete','updatedAt',stamp);
 insert into public.velori_studio_requests(user_id,request_id,kind,state,source,result,finished_at) values(p_user,p_request,'save','complete','editor',result,stamp);
 return result;
end $$;
create function public.velori_studio_order(p_user uuid,p_request uuid,p_sku text,p_price text,p_amount integer,p_currency text,p_live boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.velori_studio_orders%rowtype;
begin
 perform public.velori_studio_account(p_user);
 if (select count(*) from public.velori_studio_orders where user_id=p_user and created_at>clock_timestamp()-interval '1 hour')>=10 then raise exception 'checkout rate limit'; end if;
 insert into public.velori_studio_orders(user_id,request_id,sku,price_id,amount,currency,livemode) values(p_user,p_request,p_sku,p_price,p_amount,p_currency,p_live) on conflict(user_id,request_id) do nothing;
 select * into o from public.velori_studio_orders where user_id=p_user and request_id=p_request;
 if o.sku<>p_sku or o.price_id<>p_price or o.amount<>p_amount or o.currency<>p_currency or o.livemode<>p_live then raise exception 'checkout request conflict'; end if;
 return to_jsonb(o);
end $$;
create function public.velori_studio_fulfill(p_event text,p_order uuid,p_checkout text,p_payment text) returns boolean language plpgsql security invoker set search_path='' as $$
declare o public.velori_studio_orders%rowtype;
begin
 select * into o from public.velori_studio_orders where id=p_order for update;
 if not found or (o.checkout_id is not null and o.checkout_id<>p_checkout) or p_payment is null or p_payment !~ '^pi_[A-Za-z0-9]+$' then return false; end if;
 if exists(select 1 from public.velori_studio_billing_events where event_id=p_event and order_id<>p_order) then return false; end if;
 perform public.velori_studio_account(o.user_id);
 insert into public.velori_studio_billing_events(event_id,order_id) values(p_event,p_order) on conflict do nothing;
 if o.status<>'pending' then return true; end if;
 update public.velori_studio_orders set status='paid',checkout_id=p_checkout,payment_id=p_payment,paid_at=clock_timestamp() where id=p_order;
 if o.sku='PREMIUM' then update public.velori_studio_accounts set plan='PREMIUM' where user_id=o.user_id; else update public.velori_studio_accounts set tokens=tokens+100 where user_id=o.user_id; end if;
 return true;
end $$;
create function public.velori_studio_revoke_payment(p_event text,p_payment text) returns boolean language plpgsql security invoker set search_path='' as $$
declare o public.velori_studio_orders%rowtype;
begin
 select * into o from public.velori_studio_orders where payment_id=p_payment for update;
 if not found then return false; end if;
 if exists(select 1 from public.velori_studio_billing_events where event_id=p_event and order_id<>o.id) then return false; end if;
 perform public.velori_studio_account(o.user_id);
 insert into public.velori_studio_billing_events(event_id,order_id) values(p_event,o.id) on conflict do nothing;
 if o.status='refunded' then return true; end if; if o.status<>'paid' then return false; end if;
 update public.velori_studio_orders set status='refunded' where id=o.id;
 if o.sku='PACK100' then update public.velori_studio_accounts set tokens=tokens-100 where user_id=o.user_id; elsif not exists(select 1 from public.velori_studio_orders where user_id=o.user_id and sku='PREMIUM' and status='paid') then update public.velori_studio_accounts set plan='FREE' where user_id=o.user_id; end if;
 return true;
end $$;
revoke all on function public.velori_studio_valid_payload(jsonb),public.velori_studio_cleanup(uuid),public.velori_studio_account(uuid),public.velori_studio_reserve(uuid,uuid,integer),public.velori_studio_finish(uuid,uuid,jsonb),public.velori_studio_save(uuid,uuid,uuid,text,jsonb,timestamptz),public.velori_studio_order(uuid,uuid,text,text,integer,text,boolean),public.velori_studio_fulfill(text,uuid,text,text),public.velori_studio_revoke_payment(text,text) from public,anon,authenticated;
grant execute on function public.velori_studio_valid_payload(jsonb),public.velori_studio_cleanup(uuid),public.velori_studio_account(uuid),public.velori_studio_reserve(uuid,uuid,integer),public.velori_studio_finish(uuid,uuid,jsonb),public.velori_studio_save(uuid,uuid,uuid,text,jsonb,timestamptz),public.velori_studio_order(uuid,uuid,text,text,integer,text,boolean),public.velori_studio_fulfill(text,uuid,text,text),public.velori_studio_revoke_payment(text,text) to service_role;
commit;
