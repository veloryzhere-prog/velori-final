-- VELORYZ administrator bootstrap claim and rotatable access code.
--
-- Two problems are fixed here, both found by re-auditing the live contract on
-- 2026-10-02.
--
-- 1. BOOTSTRAP WAS NOT ATOMIC.
--    public.admin_bootstrap_available() took a transaction-scoped advisory
--    lock, counted administrator rows, and returned. That lock was released
--    when the RPC's own transaction committed -- which happens BEFORE the Edge
--    Function calls auth.admin.createUser() and inserts into admin_profiles,
--    because those are separate HTTP round trips. Two simultaneous
--    first-time-setup submissions could therefore both observe "no
--    administrator exists" and both succeed, minting two super administrators
--    from a one-time code.
--
--    This migration replaces the advisory-lock check with a durable singleton
--    claim row. `insert ... on conflict do nothing` is atomic on its own, so
--    the loser of the race updates zero rows and is told the claim was taken.
--    A failed attempt releases the claim so the operator can retry; a
--    successful attempt finalises it against the new administrator's id.
--
-- 2. THE ACCESS CODE COULD NOT BE CHANGED.
--    The bootstrap code existed only as the ADMIN_SETUP_CODE Edge Function
--    secret, which meant the initial value stayed live until someone manually
--    deleted the secret and redeployed. There was no in-product rotation, and
--    no way to retire the initial value from inside the application.
--
--    public.admin_access_code stores a salted PBKDF2-HMAC-SHA256 hash of the
--    current access code. The plaintext is never stored, never logged and
--    never returned to a client. The initial value continues to work through
--    the environment secret until a database code is stored; that row
--    immediately supersedes the secret, including when deliberately disabled.
--
-- Every object is created only when missing, so this migration is safe to
-- apply to a fresh database, to the partially applied live project, and to a
-- project where the repair migration already ran.

-- ---------------------------------------------------------------------------
-- Bootstrap claim singleton
-- ---------------------------------------------------------------------------
--
-- `id` is a boolean primary key with a check that forces it to true, so the
-- table can physically hold at most one row. That is what makes the claim a
-- genuine singleton rather than a convention.

create table if not exists public.admin_bootstrap_claims (
  id boolean primary key default true check (id),
  claimed_at timestamptz not null default now(),
  finalized_user_id uuid references auth.users(id) on delete set null
);

create index if not exists admin_bootstrap_claims_claimed_idx
  on public.admin_bootstrap_claims (claimed_at desc);

-- ---------------------------------------------------------------------------
-- Rotatable administrator access code
-- ---------------------------------------------------------------------------
--
-- One row. `code_hash` is `pbkdf2$<iterations>$<salt-b64>$<hash-b64>`, derived
-- in the Edge Function with WebCrypto. The plaintext code never leaves the
-- request that set it.

create table if not exists public.admin_access_code (
  id boolean primary key default true check (id),
  code_hash text not null,
  iterations integer not null check (iterations between 10000 and 1000000),
  enabled boolean not null default true,
  rotated_at timestamptz not null default now(),
  rotated_by uuid references auth.users(id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Claim the bootstrap
-- ---------------------------------------------------------------------------
--
-- Returns true only for the single caller that inserted the claim row while no
-- administrator existed. Everyone else gets false, including a caller that
-- arrives after a successful bootstrap finalised the row.

create or replace function public.admin_bootstrap_claim()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_admin integer;
  inserted integer;
begin
  -- Re-check under the same advisory lock the previous implementation used.
  -- This is belt-and-braces: the insert below is the real guarantee, but
  -- keeping the lock means a legacy caller still on the old contract observes
  -- the same serialisation it did before.
  perform pg_advisory_xact_lock(hashtext('veloryz.admin.bootstrap'));

  select count(*) into existing_admin from public.admin_profiles;
  if existing_admin > 0 then
    return false;
  end if;

  -- Deliberately does not purge a stale row here. A crashed bootstrap must be
  -- released by admin_bootstrap_settle(false, null) so that a retry is possible
  -- without an operator dropping tables by hand.
  insert into public.admin_bootstrap_claims (id)
  values (true)
  on conflict (id) do nothing;

  get diagnostics inserted = row_count;
  return inserted = 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Release or finalise the claim
-- ---------------------------------------------------------------------------
--
-- `p_keep = false` runs when user creation or the admin_profiles insert failed,
-- so the operator may try again. `p_keep = true` runs on success and pins the
-- claim to the new administrator so the endpoint stays closed afterwards.

create or replace function public.admin_bootstrap_settle(
  p_keep boolean,
  p_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_keep then
    update public.admin_bootstrap_claims
      set finalized_user_id = p_user_id,
          claimed_at = now()
      where id = true;
  else
    delete from public.admin_bootstrap_claims where id = true;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Access code status
-- ---------------------------------------------------------------------------
--
-- Reports presence and recency only. The hash is deliberately not projected, so
-- it cannot be returned to a client even by mistake.

create or replace function public.admin_access_code_status()
returns table (
  configured boolean,
  enabled boolean,
  rotated_at timestamptz,
  rotated_by uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
    select
      true,
      ac.enabled,
      ac.rotated_at,
      ac.rotated_by
    from public.admin_access_code ac
    where ac.id = true;

  if not found then
    return query select false, false, null::timestamptz, null::uuid;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Persist a rotated code, or disable the code entirely
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_access_code(
  p_code_hash text,
  p_iterations integer,
  p_user_id uuid,
  p_enabled boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_enabled then
    if p_code_hash is null or p_iterations is null then
      raise exception 'a code hash and iteration count are required to enable the access code'
        using errcode = '22023';
    end if;
    insert into public.admin_access_code (id, code_hash, iterations, enabled, rotated_at, rotated_by)
    values (true, p_code_hash, p_iterations, true, now(), p_user_id)
    on conflict (id) do update
      set code_hash = excluded.code_hash,
          iterations = excluded.iterations,
          enabled = true,
          rotated_at = excluded.rotated_at,
          rotated_by = excluded.rotated_by;
  else
    -- Disabling keeps the stored hash so the code can be re-enabled later
    -- without the administrator having to remember it.
    update public.admin_access_code
      set enabled = false,
          rotated_at = now(),
          rotated_by = p_user_id
      where id = true;

    if not found then
      insert into public.admin_access_code (id, code_hash, iterations, enabled, rotated_at, rotated_by)
      values (true, 'disabled', 100000, false, now(), p_user_id);
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
--
-- service_role only. public, anon and authenticated are revoked explicitly so a
-- client can never enumerate the access-code state or settle a claim.

revoke all on table public.admin_bootstrap_claims from public, anon, authenticated;
revoke all on table public.admin_access_code from public, anon, authenticated;

alter table public.admin_bootstrap_claims enable row level security;
alter table public.admin_access_code enable row level security;

revoke all on function public.admin_bootstrap_claim() from public, anon, authenticated;
revoke all on function public.admin_bootstrap_settle(boolean, uuid) from public, anon, authenticated;
revoke all on function public.admin_access_code_status() from public, anon, authenticated;
revoke all on function public.admin_set_access_code(text, integer, uuid, boolean) from public, anon, authenticated;

grant execute on function public.admin_bootstrap_claim() to service_role;
grant execute on function public.admin_bootstrap_settle(boolean, uuid) to service_role;
grant execute on function public.admin_access_code_status() to service_role;
grant execute on function public.admin_set_access_code(text, integer, uuid, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- Post-apply report
-- ---------------------------------------------------------------------------

do $$
declare
  claim_rows integer := 0;
  code_rows integer := 0;
begin
  if to_regclass('public.admin_bootstrap_claims') is not null then
    select count(*) into claim_rows from public.admin_bootstrap_claims;
  end if;
  if to_regclass('public.admin_access_code') is not null then
    select count(*) into code_rows from public.admin_access_code;
  end if;

  if claim_rows > 0 then
    raise warning 'A bootstrap claim already exists; first-time setup is closed and the code path is refused.';
  else
    raise notice 'Bootstrap claim table is empty. Set ADMIN_SETUP_CODE and run first-time setup at /admin/login.';
  end if;

  if code_rows > 0 then
    raise notice 'An access code hash is stored. Admin -> Security can rotate or disable it.';
  else
    raise notice 'No rotated access code is stored yet; only the ADMIN_SETUP_CODE secret is accepted.';
  end if;
end;
$$;
