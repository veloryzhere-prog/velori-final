-- VELORI dedicated administrator credentials.
--
-- Replaces the email-based administrator sign-in with a self-contained
-- username + password credential owned by the server. The administrator types a
-- username (never an email); the Edge Function verifies a PBKDF2 hash stored in
-- this table, then issues an opaque admin-only session token. The linked
-- Supabase Auth identity remains an internal key for admin_profiles and role
-- authorization; the browser never receives or uses its Auth session. Normal
-- VELORI user authentication is untouched.
--
-- Secret handling
-- ---------------
-- Only `password_hash` (format `pbkdf2$<iterations>$<salt>$<hash>`) is stored.
-- The plaintext password never reaches the database, a migration file, an audit
-- row, a log line or the browser bundle.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------

create table if not exists public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  -- The authorization identity. Unique so one administrator identity has exactly
  -- one credential record.
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null check (char_length(trim(username)) between 3 and 64),
  password_hash text not null default '',
  role_key text not null default 'super_admin' references public.admin_roles(key),
  enabled boolean not null default true,
  must_change_password boolean not null default false,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.admin_accounts is
  'Dedicated VELORI administrator credentials. The administrator signs in with a username and password; the password is stored only as a PBKDF2 hash. user_id links to the Supabase Auth identity that carries authorization. Service-role access only: never readable by anon or authenticated.';
comment on column public.admin_accounts.username is
  'Administrator login name. Compared case-insensitively; the original casing is preserved for display.';
comment on column public.admin_accounts.password_hash is
  'PBKDF2-HMAC-SHA256 hash in the format pbkdf2$<iterations>$<base64 salt>$<base64 derived key>. An empty value means no password has been set yet and every sign-in fails closed.';
comment on column public.admin_accounts.locked_until is
  'While this is in the future the account is temporarily locked after repeated failed sign-ins. Cleared on a successful sign-in.';

-- Case-insensitive uniqueness, so `VELORYZMANAGEARYAN` and
-- `veloryzmanagearyan` cannot both exist.
create unique index if not exists admin_accounts_username_lower_idx
  on public.admin_accounts (lower(username));
create index if not exists admin_accounts_enabled_idx
  on public.admin_accounts (enabled);

-- ---------------------------------------------------------------------------
-- 2. updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.admin_accounts_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists admin_accounts_touch_updated_at on public.admin_accounts;
create trigger admin_accounts_touch_updated_at
  before update on public.admin_accounts
  for each row execute function public.admin_accounts_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Access boundary: the credential table is service-role only.
-- ---------------------------------------------------------------------------

alter table public.admin_accounts enable row level security;
revoke all on public.admin_accounts from public, anon, authenticated;
grant all on public.admin_accounts to service_role;

-- ---------------------------------------------------------------------------
-- 4. Defensive backfill for administrators created before this migration.
-- ---------------------------------------------------------------------------
-- Any administrator row that predates the credential table is given a credential
-- record so the account remains visible and manageable from the console. The
-- generated password hash is intentionally empty, which fails closed: such an
-- account cannot sign in until a super administrator sets a password for it from
-- Admin -> Security, and the account is flagged must_change_password. No password
-- is fabricated, and no existing data (profiles, posts, messages, audit rows) is
-- touched. To initialize the primary administrator credential, configure the
-- password in protected server secrets and run pnpm admin:initialize.

insert into public.admin_accounts (user_id, username, password_hash, role_key, enabled, must_change_password)
select
  ap.user_id,
  -- Derive a unique, valid placeholder username from the identity uuid so the
  -- insert cannot collide; the operator renames it during the password reset.
  'admin-' || replace(substr(ap.user_id::text, 1, 8), '-', ''),
  '',
  coalesce(ap.role_key, 'admin'),
  false,
  true
from public.admin_profiles ap
where not exists (
  select 1 from public.admin_accounts aa where aa.user_id = ap.user_id
)
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Self-check
-- ---------------------------------------------------------------------------

do $$
declare
  missing text[] := array[]::text[];
begin
  if to_regclass('public.admin_accounts') is null then
    missing := missing || 'admin_accounts';
  end if;
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and tablename = 'admin_accounts'
       and indexname = 'admin_accounts_username_lower_idx'
  ) then
    missing := missing || 'admin_accounts_username_lower_idx';
  end if;
  if array_length(missing, 1) is not null then
    raise exception 'VELORI admin_accounts migration incomplete: missing %', array_to_string(missing, ', ');
  end if;
  raise notice 'VELORI admin_accounts credentials table is present and service-role only.';
end;
$$;
