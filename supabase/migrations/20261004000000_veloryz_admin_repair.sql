-- VELORYZ administrator schema repair.
--
-- Live verification on 2026-10-02 found the administrator migration in a
-- PARTIALLY APPLIED state: the admin_profiles, site_settings, admin_audit_logs
-- and admin_login_attempts tables and their RLS policies exist and correctly
-- deny anonymous access, but the `site-assets` storage bucket does NOT exist.
-- `GET /storage/v1/object/list/site-assets` returns NoSuchBucket, so the admin
-- logo upload would fail at runtime even with the Edge Function deployed.
--
-- This migration is idempotent so it can be applied to a partially applied
-- project, to a fresh project, or to one that is already correct. Every object
-- is created only when missing rather than with a bare CREATE, so re-running it
-- cannot abort on "already exists".

-- ---------------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-assets', 'site-assets', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- The bucket is read-only to the public. There is deliberately no insert,
-- update or delete policy for clients: uploads are performed by the Edge
-- Function with the service-role key after magic-byte validation.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public reads site assets'
  ) then
    create policy "Public reads site assets" on storage.objects for select
      using (bucket_id = 'site-assets');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Last-super-administrator protection, enforced in the database
-- ---------------------------------------------------------------------------
--
-- The Edge Function also refuses to remove the final super administrator, but a
-- UI check is not a guarantee: anything holding the service-role key, or a
-- future migration, could bypass it. This trigger makes the invariant a
-- database rule instead, so administration cannot be permanently locked out.

create or replace function public.admin_protect_last_super_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining integer;
  removing_admin boolean;
begin
  -- Only a change that would remove the last active super administrator is
  -- blocked. Demotion, deactivation and deletion are all covered.
  perform pg_advisory_xact_lock(hashtext('veloryz.admin.last-super-admin'));

  removing_admin := tg_op = 'DELETE';
  if tg_op = 'UPDATE' then
    removing_admin := new.role is distinct from 'super_admin'
      or new.is_active is distinct from true;
  end if;

  if old.role = 'super_admin' and old.is_active and removing_admin then
    select count(*) into remaining
    from public.admin_profiles
    where role = 'super_admin'
      and is_active
      and user_id <> old.user_id;

    if remaining = 0 then
      raise exception 'refusing to remove the final active super administrator'
        using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists admin_profiles_protect_last_super on public.admin_profiles;
create trigger admin_profiles_protect_last_super
  before update or delete on public.admin_profiles
  for each row execute function public.admin_protect_last_super_admin();

-- ---------------------------------------------------------------------------
-- Serialised bootstrap
-- ---------------------------------------------------------------------------
--
-- The bootstrap route checks "does an administrator already exist?" and then
-- inserts. Two concurrent requests could both pass that check and create two
-- first administrators. This function takes a transaction-scoped advisory lock
-- and reports whether the caller may proceed, so the check is serialised
-- against other bootstrap attempts.
--
-- The lock key is a fixed project-local constant. No attacker-controlled value
-- reaches it and the function executes no dynamic SQL.

create or replace function public.admin_bootstrap_available()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing integer;
begin
  perform pg_advisory_xact_lock(hashtext('veloryz.admin.bootstrap'));
  select count(*) into existing from public.admin_profiles;
  return existing = 0;
end;
$$;

revoke all on function public.admin_bootstrap_available() from public, anon, authenticated;
revoke all on function public.admin_protect_last_super_admin() from public, anon, authenticated;

grant execute on function public.admin_bootstrap_available() to service_role;
grant execute on function public.admin_protect_last_super_admin() to service_role;

-- ---------------------------------------------------------------------------
-- Post-apply report
-- ---------------------------------------------------------------------------
--
-- Prints what is still missing after this migration runs, so a partially applied
-- project is visible immediately in the SQL editor output rather than being
-- discovered later through a failed request.

do $$
declare
  bucket_present boolean := false;
  admin_count integer := 0;
begin
  -- Guarded with plpgsql IF rather than a SQL AND, because Postgres does not
  -- guarantee operand evaluation order: referencing storage.buckets in a
  -- conjunction could still error on a project where the schema is absent.
  if to_regclass('storage.buckets') is not null then
    select exists (select 1 from storage.buckets where id = 'site-assets')
      into bucket_present;
  end if;

  if bucket_present then
    raise notice 'VELORYZ repair applied. site-assets bucket is present.';
  else
    raise warning 'VELORYZ repair could not create the site-assets bucket. Check privileges on storage.buckets.';
  end if;

  if to_regclass('public.admin_profiles') is not null then
    select count(*) into admin_count from public.admin_profiles;
  end if;

  if admin_count = 0 then
    raise notice 'No administrator exists yet. Set ADMIN_SETUP_CODE and run first-time setup at /admin/login.';
  else
    raise notice '% administrator row(s) exist; the bootstrap code will be refused.', admin_count;
  end if;
end;
$$;