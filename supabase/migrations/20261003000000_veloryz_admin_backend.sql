-- VELORYZ administrator backend helpers.
--
-- The administrator Edge Function needs aggregate counts, filtered pagination
-- over auth.users, and table-presence diagnostics. None of that is reachable
-- through PostgREST or the JS admin API, so it lives here instead of in the
-- function body.
--
-- Every function below is SECURITY DEFINER with a pinned search_path and is
-- revoked from PUBLIC. Only the service-role key may execute them; browser
-- clients can never call them, even through the authenticated role.

-- Account totals for the administrator overview panel.
create or replace function public.admin_user_totals()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'verified', (select count(*) from auth.users where email_confirmed_at is not null),
    'unverified', (select count(*) from auth.users where email_confirmed_at is null),
    'sampled', (select count(*) from auth.users where last_sign_in_at is not null)
  );
$$;

-- Searchable, paginated account list. Matches the email or the exact UUID.
-- The administrator columns come from a LEFT JOIN so a super administrator can
-- see, and promote or demote, other administrators without a second query.
create or replace function public.admin_user_list(
  search text,
  page integer,
  per_page integer
)
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  verified boolean,
  admin_role public.admin_role,
  admin_active boolean
)
language sql
security definer
set search_path = ''
as $$
  select
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    u.banned_until,
    (u.email_confirmed_at is not null),
    a.role,
    a.is_active
  from auth.users u
  left join public.admin_profiles a on a.user_id = u.id
  where nullif(btrim(coalesce(search, '')), '') is null
     or u.email ilike '%' || btrim(search) || '%'
     or u.id::text = btrim(search)
  order by u.created_at desc
  limit least(greatest(coalesce(per_page, 20), 1), 100)
  offset (greatest(coalesce(page, 1), 1) - 1) * least(greatest(coalesce(per_page, 20), 1), 100);
$$;

-- Row count for the matching search, used for the pagination footer.
create or replace function public.admin_user_count(search text)
returns integer
language sql
security definer
set search_path = ''
as $$
  select count(*)::integer
  from auth.users u
  where nullif(btrim(coalesce(search, '')), '') is null
     or u.email ilike '%' || btrim(search) || '%'
     or u.id::text = btrim(search);
$$;

-- Reports whether each table the application depends on has been installed,
-- so the system-health panel can name the migration that is still missing
-- instead of reporting a bare failure.
create or replace function public.admin_table_health()
returns table (
  name text,
  ok boolean,
  diagnosis text
)
language sql
security definer
set search_path = ''
as $$
  select
    t.name,
    to_regclass('public.' || t.name) is not null,
    case
      when to_regclass('public.' || t.name) is not null then null
      when t.name in ('admin_profiles', 'site_settings', 'admin_audit_logs', 'admin_login_attempts')
        then 'Apply supabase/migrations/20261002000000_veloryz_admin.sql.'
      else 'Apply supabase/migrations/20261001000000_velori_core.sql.'
    end
  from (
    values
      ('profiles'),
      ('posts'),
      ('likes'),
      ('saves'),
      ('comments'),
      ('post_tags'),
      ('admin_profiles'),
      ('site_settings'),
      ('admin_audit_logs'),
      ('admin_login_attempts')
  ) as t(name);
$$;

-- Oldest outstanding failed login attempts are trimmed hourly so the table
-- cannot grow without bound. Returns the number of rows removed.
create or replace function public.admin_prune_login_attempts(older_than_hours integer)
returns integer
language sql
security definer
set search_path = ''
as $$
  with removed as (
    delete from public.admin_login_attempts
    where created_at < now() - make_interval(hours => greatest(coalesce(older_than_hours, 24), 1))
    returning id
  )
  select count(*)::integer from removed;
$$;

revoke all on function public.admin_user_totals() from public, anon, authenticated;
revoke all on function public.admin_user_list(text, integer, integer) from public, anon, authenticated;
revoke all on function public.admin_user_count(text) from public, anon, authenticated;
revoke all on function public.admin_table_health() from public, anon, authenticated;
revoke all on function public.admin_prune_login_attempts(integer) from public, anon, authenticated;

grant execute on function public.admin_user_totals() to service_role;
grant execute on function public.admin_user_list(text, integer, integer) to service_role;
grant execute on function public.admin_user_count(text) to service_role;
grant execute on function public.admin_table_health() to service_role;
grant execute on function public.admin_prune_login_attempts(integer) to service_role;