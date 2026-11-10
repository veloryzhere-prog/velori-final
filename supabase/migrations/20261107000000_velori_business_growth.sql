begin;

create table if not exists public.velori_offers (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  offer_type text not null check (offer_type in ('percentage', 'fixed_amount', 'bundle', 'free_trial', 'manual')),
  eligibility text not null check (eligibility in ('all_users', 'new_users', 'pro_users', 'creator_users', 'vip_users')),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  usage_limit integer not null check (usage_limit between 1 and 10000000),
  usage_count integer not null default 0 check (usage_count between 0 and usage_limit),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint velori_offers_valid_window check (ends_at > starts_at),
  constraint velori_offers_archive_state check ((status = 'archived') = (archived_at is not null))
);

create index if not exists velori_offers_status_window_idx
  on public.velori_offers (status, starts_at, ends_at);
create index if not exists velori_offers_updated_idx
  on public.velori_offers (updated_at desc);
alter table public.velori_offers enable row level security;
revoke all on public.velori_offers from public, anon, authenticated;
grant all on public.velori_offers to service_role;

insert into public.admin_permissions (key, category, label, description, risk, sort_order)
values
  ('offers.view', 'Business & Growth', 'View offers', 'Read offer configuration and lifecycle state.', 'standard', 70),
  ('offers.edit', 'Business & Growth', 'Manage offers', 'Create, edit, activate, deactivate and archive offers.', 'elevated', 71),
  ('referrals.view', 'Business & Growth', 'View referrals', 'Review referral attribution and reward processing records.', 'standard', 72),
  ('referrals.edit', 'Business & Growth', 'Manage referral program', 'Configure referral eligibility, rewards and limits.', 'elevated', 73),
  ('referrals.reverse', 'Business & Growth', 'Reverse referral rewards', 'Reverse an issued Forge-token referral reward.', 'critical', 74)
on conflict (key) do update
set category = excluded.category,
    label = excluded.label,
    description = excluded.description,
    risk = excluded.risk,
    sort_order = excluded.sort_order;

insert into public.admin_role_permissions (role_key, permission_key)
select role_key, permission_key
from (values
  ('super_admin', 'offers.view'), ('super_admin', 'offers.edit'),
  ('super_admin', 'referrals.view'), ('super_admin', 'referrals.edit'), ('super_admin', 'referrals.reverse'),
  ('admin', 'offers.view'), ('admin', 'offers.edit'),
  ('admin', 'referrals.view'), ('admin', 'referrals.edit'), ('admin', 'referrals.reverse')
) as permissions(role_key, permission_key)
on conflict do nothing;

create table if not exists public.velori_referral_program (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  require_verified_email boolean not null default true,
  min_successful_generations integer not null default 1 check (min_successful_generations between 1 and 100),
  inviter_reward_tokens integer not null default 0 check (inviter_reward_tokens between 0 and 1000),
  invitee_reward_tokens integer not null default 0 check (invitee_reward_tokens between 0 and 1000),
  max_rewards_per_inviter integer not null default 50 check (max_rewards_per_inviter between 1 and 10000),
  max_total_qualified_referrals integer not null default 10000 check (max_total_qualified_referrals between 1 and 1000000),
  max_lifetime_reward_tokens_per_user integer not null default 10000 check (max_lifetime_reward_tokens_per_user between 1 and 1000000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint velori_referral_program_valid_window check (ends_at is null or starts_at is null or ends_at > starts_at)
);
insert into public.velori_referral_program (id) values (true) on conflict (id) do nothing;

create table if not exists public.velori_referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^VLR-[A-F0-9]{24}$'),
  enabled boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists velori_referral_codes_enabled_idx
  on public.velori_referral_codes (code) where enabled;

create table if not exists public.velori_referrals (
  id uuid primary key default gen_random_uuid(),
  invitee_id uuid unique references auth.users(id) on delete set null,
  inviter_id uuid references auth.users(id) on delete set null,
  referral_code text not null check (char_length(referral_code) between 1 and 40),
  status text not null check (status in ('pending', 'qualified', 'rejected')),
  status_reason text,
  installation_verification_status text not null default 'unsupported'
    check (installation_verification_status in ('unsupported', 'pending', 'verified', 'rejected')),
  installation_verified_at timestamptz,
  registered_at timestamptz not null default now(),
  qualified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint velori_referrals_not_self check (inviter_id is null or inviter_id <> invitee_id),
  constraint velori_referrals_qualified_timestamp check ((status = 'qualified') = (qualified_at is not null)),
  constraint velori_referrals_install_verification_timestamp check (
    (installation_verification_status = 'verified') = (installation_verified_at is not null)
  )
);
create index if not exists velori_referrals_inviter_registered_idx
  on public.velori_referrals (inviter_id, registered_at desc);
create index if not exists velori_referrals_status_registered_idx
  on public.velori_referrals (status, registered_at desc);

create table if not exists public.velori_reward_transactions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.velori_referrals(id) on delete restrict,
  recipient_id uuid references auth.users(id) on delete set null,
  reward_type text not null check (reward_type in ('inviter_forge_tokens', 'invitee_forge_tokens')),
  amount integer not null check (amount between 1 and 1000),
  status text not null default 'granted' check (status in ('granted', 'reversed')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete set null,
  reversal_reason text,
  constraint velori_reward_transactions_reversal_state check (
    (status = 'reversed') = (reversed_at is not null and reversed_by is not null and reversal_reason is not null)
  ),
  constraint velori_reward_transactions_once unique (referral_id, recipient_id, reward_type)
);
create index if not exists velori_reward_transactions_recipient_idx
  on public.velori_reward_transactions (recipient_id, created_at desc);
create index if not exists velori_reward_transactions_status_idx
  on public.velori_reward_transactions (status, created_at desc);

create table if not exists public.velori_referral_events (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.velori_referrals(id) on delete cascade,
  event_type text not null check (event_type in (
    'registration_pending', 'registration_rejected', 'qualification_pending',
    'qualification_rejected', 'qualified', 'reward_granted', 'reward_reversed',
    'processing_failed'
  )),
  reason text not null default '',
  actor_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb check (octet_length(details::text) <= 4000),
  occurred_at timestamptz not null default now(),
  constraint velori_referral_events_deduplicated unique (referral_id, event_type, reason)
);
create index if not exists velori_referral_events_recent_idx
  on public.velori_referral_events (occurred_at desc);
create index if not exists velori_referral_events_referral_idx
  on public.velori_referral_events (referral_id, occurred_at desc);

alter table public.velori_referral_program enable row level security;
alter table public.velori_referral_codes enable row level security;
alter table public.velori_referrals enable row level security;
alter table public.velori_reward_transactions enable row level security;
alter table public.velori_referral_events enable row level security;
revoke all on public.velori_referral_program, public.velori_referral_codes,
  public.velori_referrals, public.velori_reward_transactions,
  public.velori_referral_events from public, anon, authenticated;
grant all on public.velori_referral_program, public.velori_referral_codes,
  public.velori_referrals, public.velori_reward_transactions,
  public.velori_referral_events to service_role;

create or replace function public.velori_log_referral_event(
  p_referral_id uuid,
  p_event_type text,
  p_reason text default '',
  p_actor_user_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.velori_referral_events (
    referral_id, event_type, reason, actor_user_id, details
  )
  values (
    p_referral_id, p_event_type, coalesce(p_reason, ''),
    p_actor_user_id, coalesce(p_details, '{}'::jsonb)
  )
  on conflict (referral_id, event_type, reason) do nothing;
$$;
revoke all on function public.velori_log_referral_event(uuid, text, text, uuid, jsonb) from public, anon, authenticated;

create or replace function public.velori_referral_code_reason(p_code text, p_invitee uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code_row public.velori_referral_codes%rowtype;
  program_row public.velori_referral_program%rowtype;
begin
  if p_code is null or length(p_code) > 40 or p_code !~* '^VLR-[A-F0-9]{24}$' then
    return 'invalid_code';
  end if;

  select * into code_row
    from public.velori_referral_codes
   where code = upper(p_code);
  if not found then return 'invalid_code'; end if;
  if not code_row.enabled then return 'disabled_code'; end if;
  if code_row.expires_at is not null and code_row.expires_at <= now() then return 'expired_code'; end if;
  if p_invitee is not null and code_row.user_id = p_invitee then return 'self_referral'; end if;
  if p_invitee is not null and exists (
    select 1 from public.velori_referrals where invitee_id = p_invitee
  ) then return 'already_used'; end if;

  select * into program_row from public.velori_referral_program where id = true;
  if not found or not program_row.enabled then return 'program_disabled'; end if;
  if program_row.starts_at is not null and program_row.starts_at > now() then return 'program_not_started'; end if;
  if program_row.ends_at is not null and program_row.ends_at <= now() then return 'program_expired'; end if;
  return null;
end;
$$;
revoke all on function public.velori_referral_code_reason(text, uuid) from public, anon, authenticated;

create or replace function public.velori_validate_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reason text;
begin
  reason := public.velori_referral_code_reason(p_code, auth.uid());
  return jsonb_build_object('valid', reason is null, 'reason', reason);
end;
$$;
revoke all on function public.velori_validate_referral_code(text) from public;
grant execute on function public.velori_validate_referral_code(text) to anon, authenticated;

create or replace function public.velori_create_referral_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
  supplied_code text;
  code_reason text;
begin
  if coalesce(new.raw_user_meta_data ->> 'administrator_identity', '') = 'true' then
    return new;
  end if;

  loop
    candidate := 'VLR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 24));
    exit when not exists (select 1 from public.velori_referral_codes where code = candidate);
  end loop;
  insert into public.velori_referral_codes (user_id, code)
  values (new.id, candidate)
  on conflict (user_id) do nothing;

  supplied_code := upper(left(btrim(coalesce(new.raw_user_meta_data ->> 'referral_code', '')), 40));
  if supplied_code = '' then return new; end if;

  code_reason := public.velori_referral_code_reason(supplied_code, new.id);
  insert into public.velori_referrals (
    invitee_id, inviter_id, referral_code, status, status_reason
  )
  values (
    new.id,
    case when code_reason is null then (
      select user_id from public.velori_referral_codes where code = supplied_code
    ) else null end,
    supplied_code,
    case when code_reason is null then 'pending' else 'rejected' end,
    code_reason
  )
  on conflict (invitee_id) do nothing;
  if found then
    perform public.velori_log_referral_event(
      (select id from public.velori_referrals where invitee_id = new.id),
      case when code_reason is null then 'registration_pending' else 'registration_rejected' end,
      coalesce(code_reason, ''),
      new.id,
      jsonb_build_object('code', supplied_code)
    );
  end if;
  return new;
end;
$$;
revoke all on function public.velori_create_referral_identity() from public, anon, authenticated;
drop trigger if exists on_auth_user_referral_created on auth.users;
create trigger on_auth_user_referral_created
  after insert on auth.users
  for each row execute function public.velori_create_referral_identity();

do $$
declare
  account record;
  candidate text;
begin
  for account in
    select u.id from auth.users u
     where coalesce(u.raw_user_meta_data ->> 'administrator_identity', '') <> 'true'
  loop
    if not exists (select 1 from public.velori_referral_codes c where c.user_id = account.id) then
      loop
        candidate := 'VLR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 24));
        exit when not exists (select 1 from public.velori_referral_codes c where c.code = candidate);
      end loop;
      insert into public.velori_referral_codes (user_id, code)
      values (account.id, candidate)
      on conflict (user_id) do nothing;
    end if;
  end loop;
end;
$$;

create or replace function public.velori_qualify_referral(p_invitee uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  program_row public.velori_referral_program%rowtype;
  referral_row public.velori_referrals%rowtype;
  invitee_confirmed boolean;
  successful_generations integer;
  inviter_lifetime_tokens bigint;
  invitee_lifetime_tokens bigint;
  total_qualified bigint;
  inviter_account_tokens integer;
  invitee_account_tokens integer;
  failure_code text;
begin
  select * into program_row
    from public.velori_referral_program
   where id = true
   for update;
  if not found then return jsonb_build_object('status', 'unavailable'); end if;

  select * into referral_row
    from public.velori_referrals
   where invitee_id = p_invitee
   for update;
  if not found then return jsonb_build_object('status', 'not_referred'); end if;
  if referral_row.status <> 'pending' then
    return jsonb_build_object('status', referral_row.status, 'reason', referral_row.status_reason);
  end if;
  if referral_row.inviter_id is null then
    update public.velori_referrals
       set status = 'rejected', status_reason = 'invalid_attribution', updated_at = now()
     where id = referral_row.id;
    perform public.velori_log_referral_event(referral_row.id, 'qualification_rejected', 'invalid_attribution', auth.uid());
    return jsonb_build_object('status', 'rejected', 'reason', 'invalid_attribution');
  end if;

  if referral_row.installation_verification_status <> 'verified'
     or referral_row.installation_verified_at is null then
    failure_code := case
      when referral_row.installation_verification_status = 'unsupported'
        then 'installation_verification_unsupported'
      when referral_row.installation_verification_status = 'rejected'
        then 'installation_verification_rejected'
      else 'installation_verification_pending'
    end;
    update public.velori_referrals
       set status_reason = failure_code, updated_at = now()
     where id = referral_row.id
       and status_reason is distinct from failure_code;
    perform public.velori_log_referral_event(
      referral_row.id, 'qualification_pending', failure_code, auth.uid()
    );
    return jsonb_build_object('status', 'pending', 'reason', failure_code);
  end if;

  if not program_row.enabled then
    update public.velori_referrals set status_reason = 'program_disabled', updated_at = now()
     where id = referral_row.id and status_reason is distinct from 'program_disabled';
    perform public.velori_log_referral_event(referral_row.id, 'qualification_pending', 'program_disabled', auth.uid());
    return jsonb_build_object('status', 'pending', 'reason', 'program_disabled');
  end if;
  if program_row.inviter_reward_tokens < 1 or program_row.invitee_reward_tokens < 1 then
    update public.velori_referrals set status_reason = 'rewards_not_configured', updated_at = now()
     where id = referral_row.id and status_reason is distinct from 'rewards_not_configured';
    perform public.velori_log_referral_event(referral_row.id, 'qualification_pending', 'rewards_not_configured', auth.uid());
    return jsonb_build_object('status', 'pending', 'reason', 'rewards_not_configured');
  end if;
  if program_row.starts_at is not null and program_row.starts_at > now() then
    update public.velori_referrals set status_reason = 'program_not_started', updated_at = now()
     where id = referral_row.id and status_reason is distinct from 'program_not_started';
    perform public.velori_log_referral_event(referral_row.id, 'qualification_pending', 'program_not_started', auth.uid());
    return jsonb_build_object('status', 'pending', 'reason', 'program_not_started');
  end if;
  if program_row.ends_at is not null and program_row.ends_at <= now() then
    update public.velori_referrals
       set status = 'rejected', status_reason = 'program_expired', updated_at = now()
     where id = referral_row.id;
    perform public.velori_log_referral_event(referral_row.id, 'qualification_rejected', 'program_expired', auth.uid());
    return jsonb_build_object('status', 'rejected', 'reason', 'program_expired');
  end if;

  select (email_confirmed_at is not null) into invitee_confirmed
    from auth.users where id = p_invitee;
  if program_row.require_verified_email and not coalesce(invitee_confirmed, false) then
    update public.velori_referrals set status_reason = 'email_unverified', updated_at = now()
     where id = referral_row.id and status_reason is distinct from 'email_unverified';
    perform public.velori_log_referral_event(referral_row.id, 'qualification_pending', 'email_unverified', auth.uid());
    return jsonb_build_object('status', 'pending', 'reason', 'email_unverified');
  end if;

  select count(*)::integer into successful_generations
    from public.velori_studio_requests
   where user_id = p_invitee and kind = 'generate' and state = 'complete';
  if successful_generations < program_row.min_successful_generations then
    update public.velori_referrals set status_reason = 'generation_requirement', updated_at = now()
     where id = referral_row.id and status_reason is distinct from 'generation_requirement';
    perform public.velori_log_referral_event(referral_row.id, 'qualification_pending', 'generation_requirement', auth.uid());
    return jsonb_build_object('status', 'pending', 'reason', 'generation_requirement');
  end if;

  select count(*) into total_qualified
    from public.velori_referrals where status = 'qualified';
  if total_qualified >= program_row.max_total_qualified_referrals then
    update public.velori_referrals
       set status = 'rejected', status_reason = 'program_reward_cap', updated_at = now()
     where id = referral_row.id;
    perform public.velori_log_referral_event(referral_row.id, 'qualification_rejected', 'program_reward_cap', auth.uid());
    return jsonb_build_object('status', 'rejected', 'reason', 'program_reward_cap');
  end if;

  select count(*) into inviter_lifetime_tokens
    from public.velori_referrals r
    join public.velori_reward_transactions t on t.referral_id = r.id
   where r.inviter_id = referral_row.inviter_id
     and t.recipient_id = referral_row.inviter_id
     and t.reward_type = 'inviter_forge_tokens';
  if inviter_lifetime_tokens >= program_row.max_rewards_per_inviter then
    update public.velori_referrals
       set status = 'rejected', status_reason = 'inviter_reward_cap', updated_at = now()
     where id = referral_row.id;
    perform public.velori_log_referral_event(referral_row.id, 'qualification_rejected', 'inviter_reward_cap', auth.uid());
    return jsonb_build_object('status', 'rejected', 'reason', 'inviter_reward_cap');
  end if;

  select coalesce(sum(amount), 0) into inviter_lifetime_tokens
    from public.velori_reward_transactions
   where recipient_id = referral_row.inviter_id;
  select coalesce(sum(amount), 0) into invitee_lifetime_tokens
    from public.velori_reward_transactions
   where recipient_id = p_invitee;
  if inviter_lifetime_tokens + program_row.inviter_reward_tokens > program_row.max_lifetime_reward_tokens_per_user
     or invitee_lifetime_tokens + program_row.invitee_reward_tokens > program_row.max_lifetime_reward_tokens_per_user then
    update public.velori_referrals
       set status = 'rejected', status_reason = 'user_reward_cap', updated_at = now()
     where id = referral_row.id;
    perform public.velori_log_referral_event(referral_row.id, 'qualification_rejected', 'user_reward_cap', auth.uid());
    return jsonb_build_object('status', 'rejected', 'reason', 'user_reward_cap');
  end if;

  insert into public.velori_studio_accounts (user_id)
  values (referral_row.inviter_id), (p_invitee)
  on conflict (user_id) do nothing;
  perform 1 from public.velori_studio_accounts
   where user_id in (referral_row.inviter_id, p_invitee)
   order by user_id
   for update;
  select tokens into inviter_account_tokens from public.velori_studio_accounts
   where user_id = referral_row.inviter_id;
  select tokens into invitee_account_tokens from public.velori_studio_accounts
   where user_id = p_invitee;
  if inviter_account_tokens + program_row.inviter_reward_tokens > 1000000
     or invitee_account_tokens + program_row.invitee_reward_tokens > 1000000 then
    update public.velori_referrals
       set status = 'rejected', status_reason = 'account_balance_cap', updated_at = now()
     where id = referral_row.id;
    perform public.velori_log_referral_event(referral_row.id, 'qualification_rejected', 'account_balance_cap', auth.uid());
    return jsonb_build_object('status', 'rejected', 'reason', 'account_balance_cap');
  end if;

  begin
    update public.velori_referrals
         set status = 'qualified', status_reason = null, qualified_at = now(), updated_at = now()
       where id = referral_row.id;
    insert into public.velori_reward_transactions (
        referral_id, recipient_id, reward_type, amount, idempotency_key
    )
    values
        (referral_row.id, referral_row.inviter_id, 'inviter_forge_tokens',
         program_row.inviter_reward_tokens, referral_row.id::text || ':inviter'),
        (referral_row.id, p_invitee, 'invitee_forge_tokens',
         program_row.invitee_reward_tokens, referral_row.id::text || ':invitee');
    update public.velori_studio_accounts
         set tokens = tokens + program_row.inviter_reward_tokens
       where user_id = referral_row.inviter_id;
    update public.velori_studio_accounts
         set tokens = tokens + program_row.invitee_reward_tokens
       where user_id = p_invitee;
  exception when others then
    get stacked diagnostics failure_code = returned_sqlstate;
    update public.velori_referrals
         set status_reason = 'reward_processing_failed', updated_at = now()
       where id = referral_row.id;
    perform public.velori_log_referral_event(
        referral_row.id,
        'processing_failed',
        'reward_processing_failed',
        auth.uid(),
        jsonb_build_object('sqlstate', failure_code)
    );
    return jsonb_build_object('status', 'pending', 'reason', 'reward_processing_failed');
  end;
  perform public.velori_log_referral_event(referral_row.id, 'qualified', '', auth.uid());
  perform public.velori_log_referral_event(referral_row.id, 'reward_granted', '', auth.uid());
  return jsonb_build_object('status', 'qualified');
end;
$$;
revoke all on function public.velori_qualify_referral(uuid) from public, anon, authenticated;
grant execute on function public.velori_qualify_referral(uuid) to service_role;

create or replace function public.velori_qualify_my_referral()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception using errcode = '28000', message = 'Authentication required'; end if;
  return public.velori_qualify_referral(auth.uid());
end;
$$;
revoke all on function public.velori_qualify_my_referral() from public, anon;
grant execute on function public.velori_qualify_my_referral() to authenticated;

create or replace function public.velori_my_referral_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  program_row public.velori_referral_program%rowtype;
  account_tokens integer;
begin
  if current_user_id is null then raise exception using errcode = '28000', message = 'Authentication required'; end if;
  select * into program_row from public.velori_referral_program where id = true;
  select tokens into account_tokens from public.velori_studio_accounts where user_id = current_user_id;
  return jsonb_build_object(
    'program', jsonb_build_object(
      'enabled', coalesce(program_row.enabled, false),
      'starts_at', program_row.starts_at,
      'ends_at', program_row.ends_at,
      'require_verified_email', program_row.require_verified_email,
      'min_successful_generations', program_row.min_successful_generations,
      'inviter_reward_tokens', program_row.inviter_reward_tokens,
      'invitee_reward_tokens', program_row.invitee_reward_tokens
    ),
    'code', (select jsonb_build_object('value', code, 'enabled', enabled, 'expires_at', expires_at)
               from public.velori_referral_codes where user_id = current_user_id),
    'tokens', greatest(coalesce(account_tokens, 0), 0),
    'referrals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'status', r.status, 'status_reason', r.status_reason,
        'registered_at', r.registered_at, 'qualified_at', r.qualified_at,
        'display_name', null
      ) order by r.registered_at desc)
        from public.velori_referrals r
       where r.inviter_id = current_user_id
    ), '[]'::jsonb),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'referral_id', t.referral_id, 'reward_type', t.reward_type,
        'amount', t.amount, 'status', t.status, 'created_at', t.created_at,
        'reversed_at', t.reversed_at, 'reversal_reason', t.reversal_reason
      ) order by t.created_at desc)
        from public.velori_reward_transactions t
       where t.recipient_id = current_user_id
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.velori_my_referral_dashboard() from public, anon;
grant execute on function public.velori_my_referral_dashboard() to authenticated;

create or replace function public.velori_referral_generation_complete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.state is distinct from new.state and new.state = 'complete' and new.kind = 'generate' then
    perform public.velori_qualify_referral(new.user_id);
  end if;
  return new;
end;
$$;
revoke all on function public.velori_referral_generation_complete() from public, anon, authenticated;
drop trigger if exists velori_referral_generation_complete on public.velori_studio_requests;
create trigger velori_referral_generation_complete
  after update of state on public.velori_studio_requests
  for each row execute function public.velori_referral_generation_complete();

create or replace function public.velori_reverse_referral_reward(
  p_reward_id uuid,
  p_admin_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reward_row public.velori_reward_transactions%rowtype;
begin
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'A reversal reason is required';
  end if;
  select * into reward_row
    from public.velori_reward_transactions
   where id = p_reward_id
   for update;
  if not found then return jsonb_build_object('reversed', false, 'reason', 'not_found'); end if;
  if reward_row.status = 'reversed' then
    return jsonb_build_object('reversed', false, 'reason', 'already_reversed');
  end if;
  update public.velori_reward_transactions
     set status = 'reversed', reversed_at = now(), reversed_by = p_admin_user_id,
         reversal_reason = btrim(p_reason)
   where id = p_reward_id;
  update public.velori_studio_accounts
     set tokens = tokens - reward_row.amount
   where user_id = reward_row.recipient_id;
  perform public.velori_log_referral_event(
    reward_row.referral_id, 'reward_reversed', p_reward_id::text, p_admin_user_id,
    jsonb_build_object('reward_id', p_reward_id, 'reason', btrim(p_reason))
  );
  return jsonb_build_object('reversed', true, 'reward_id', p_reward_id);
end;
$$;
revoke all on function public.velori_reverse_referral_reward(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.velori_reverse_referral_reward(uuid, uuid, text) to service_role;

commit;
