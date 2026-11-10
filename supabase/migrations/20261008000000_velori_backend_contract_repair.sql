-- Reconcile the API contract after a partial/manual deployment.
--
-- The existing project returned PGRST205 for every social relation and 42703
-- for site_settings.error_404_enabled even though some later admin objects
-- existed. This migration intentionally reasserts the core contract so a
-- tracked-but-drifted migration history cannot silently leave the app broken.
-- All DDL is safe to apply after migrations 010-070 on a fresh database.

create extension if not exists pg_trgm;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '' check (char_length(display_name) <= 80),
  bio text not null default '' check (char_length(bio) <= 300),
  avatar_url text,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.post_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag text not null check (tag ~ '^[a-z0-9_]{1,64}$'),
  primary key (post_id, tag)
);

create index if not exists post_tags_tag_idx on public.post_tags (tag, post_id);
create index if not exists posts_feed_idx on public.posts (created_at desc, id desc);
create index if not exists posts_author_idx on public.posts (author_id, created_at desc);
create index if not exists posts_body_search_idx on public.posts using gin (body gin_trgm_ops);
create index if not exists profiles_name_search_idx on public.profiles using gin (username gin_trgm_ops);
create index if not exists likes_post_idx on public.likes (post_id);
create index if not exists saves_post_idx on public.saves (post_id);
create index if not exists comments_post_idx on public.comments (post_id, created_at desc);

create or replace function public.index_post_tags() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.post_tags where post_id = new.id;
  insert into public.post_tags (post_id, tag)
  select new.id, lower((m.parts)[1])
  from regexp_matches(new.body, '#([a-zA-Z0-9_]{1,64})', 'g') as m(parts)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists sync_post_tags on public.posts;
create trigger sync_post_tags after insert or update of body on public.posts
  for each row execute function public.index_post_tags();
revoke all on function public.index_post_tags() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.comments enable row level security;
alter table public.post_tags enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.admin_login_attempts enable row level security;

drop policy if exists "Public profiles or self" on public.profiles;
create policy "Public profiles or self" on public.profiles for select
  using (not is_private or id = (select auth.uid()));
drop policy if exists "Create own profile" on public.profiles;
create policy "Create own profile" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
drop policy if exists "Edit own profile" on public.profiles;
create policy "Edit own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "Visible posts" on public.posts;
create policy "Visible posts" on public.posts for select
  using (author_id = (select auth.uid()) or exists (
    select 1 from public.profiles p where p.id = author_id and not p.is_private
  ));
drop policy if exists "Publish own posts" on public.posts;
create policy "Publish own posts" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()));
drop policy if exists "Edit own posts" on public.posts;
create policy "Edit own posts" on public.posts for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
drop policy if exists "Delete own posts" on public.posts;
create policy "Delete own posts" on public.posts for delete to authenticated
  using (author_id = (select auth.uid()));

drop policy if exists "Visible likes" on public.likes;
create policy "Visible likes" on public.likes for select
  using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "Like visible posts" on public.likes;
create policy "Like visible posts" on public.likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "Unlike own likes" on public.likes;
create policy "Unlike own likes" on public.likes for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Read own saves" on public.saves;
create policy "Read own saves" on public.saves for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Save visible posts" on public.saves;
create policy "Save visible posts" on public.saves for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "Remove own saves" on public.saves;
create policy "Remove own saves" on public.saves for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Visible comments" on public.comments;
create policy "Visible comments" on public.comments for select
  using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "Comment on visible posts" on public.comments;
create policy "Comment on visible posts" on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id)
    and (parent_id is null or exists (select 1 from public.comments c where c.id = parent_id and c.post_id = post_id)));
drop policy if exists "Remove own comments" on public.comments;
create policy "Remove own comments" on public.comments for delete to authenticated
  using (author_id = (select auth.uid()));

drop policy if exists "Visible indexed hashtags" on public.post_tags;
create policy "Visible indexed hashtags" on public.post_tags for select
  using (exists (select 1 from public.posts p where p.id = post_id));

alter table public.site_settings
  add column if not exists error_404_enabled boolean not null default true,
  add column if not exists startup_animation_url text,
  add column if not exists error_animation_url text;
alter table public.site_settings alter column error_404_enabled set default true;
update public.site_settings set error_404_enabled = true where error_404_enabled = false;

create table if not exists public.admin_bootstrap_claims (
  id boolean primary key default true check (id),
  claimed_at timestamptz not null default now(),
  finalized_user_id uuid references auth.users(id) on delete set null
);
create index if not exists admin_bootstrap_claims_claimed_idx
  on public.admin_bootstrap_claims (claimed_at desc);

create table if not exists public.admin_access_code (
  id boolean primary key default true check (id),
  code_hash text not null,
  iterations integer not null check (iterations between 10000 and 1000000),
  enabled boolean not null default true,
  rotated_at timestamptz not null default now(),
  rotated_by uuid references auth.users(id) on delete set null
);

revoke all on table public.admin_bootstrap_claims from public, anon, authenticated;
revoke all on table public.admin_access_code from public, anon, authenticated;
alter table public.admin_bootstrap_claims enable row level security;
alter table public.admin_access_code enable row level security;

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

revoke all on function public.admin_protect_last_super_admin() from public, anon, authenticated;
drop trigger if exists admin_profiles_protect_last_super on public.admin_profiles;
create trigger admin_profiles_protect_last_super
  before update or delete on public.admin_profiles
  for each row execute function public.admin_protect_last_super_admin();

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

create or replace function public.admin_table_health()
returns table (name text, ok boolean, diagnosis text)
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
        then 'Apply the VELORI admin migrations.'
      else 'Apply the VELORI core migration.'
    end
  from (values
    ('profiles'), ('posts'), ('likes'), ('saves'), ('comments'), ('post_tags'),
    ('admin_profiles'), ('site_settings'), ('admin_audit_logs'), ('admin_login_attempts')
  ) as t(name);
$$;

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
  perform pg_advisory_xact_lock(hashtext('veloryz.admin.bootstrap'));
  select count(*) into existing_admin from public.admin_profiles;
  if existing_admin > 0 then return false; end if;
  insert into public.admin_bootstrap_claims (id) values (true)
    on conflict (id) do nothing;
  get diagnostics inserted = row_count;
  return inserted = 1;
end;
$$;

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
      set finalized_user_id = p_user_id, claimed_at = now()
      where id = true;
  else
    delete from public.admin_bootstrap_claims where id = true;
  end if;
end;
$$;

create or replace function public.admin_access_code_status()
returns table (configured boolean, enabled boolean, rotated_at timestamptz, rotated_by uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
    select true, ac.enabled, ac.rotated_at, ac.rotated_by
    from public.admin_access_code ac where ac.id = true;
  if not found then
    return query select false, false, null::timestamptz, null::uuid;
  end if;
end;
$$;

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
      raise exception 'a code hash and iteration count are required'
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
    update public.admin_access_code
      set enabled = false, rotated_at = now(), rotated_by = p_user_id
      where id = true;
    if not found then
      insert into public.admin_access_code (id, code_hash, iterations, enabled, rotated_at, rotated_by)
      values (true, 'disabled', 100000, false, now(), p_user_id);
    end if;
  end if;
end;
$$;

revoke all on function public.admin_protect_last_super_admin() from public, anon, authenticated;
revoke all on function public.admin_user_totals() from public, anon, authenticated;
revoke all on function public.admin_user_list(text, integer, integer) from public, anon, authenticated;
revoke all on function public.admin_user_count(text) from public, anon, authenticated;
revoke all on function public.admin_table_health() from public, anon, authenticated;
revoke all on function public.admin_prune_login_attempts(integer) from public, anon, authenticated;
revoke all on function public.admin_bootstrap_claim() from public, anon, authenticated;
revoke all on function public.admin_bootstrap_settle(boolean, uuid) from public, anon, authenticated;
revoke all on function public.admin_access_code_status() from public, anon, authenticated;
revoke all on function public.admin_set_access_code(text, integer, uuid, boolean) from public, anon, authenticated;

grant execute on function public.admin_user_totals() to service_role;
grant execute on function public.admin_user_list(text, integer, integer) to service_role;
grant execute on function public.admin_user_count(text) to service_role;
grant execute on function public.admin_table_health() to service_role;
grant execute on function public.admin_prune_login_attempts(integer) to service_role;
grant execute on function public.admin_bootstrap_claim() to service_role;
grant execute on function public.admin_bootstrap_settle(boolean, uuid) to service_role;
grant execute on function public.admin_access_code_status() to service_role;
grant execute on function public.admin_set_access_code(text, integer, uuid, boolean) to service_role;

drop policy if exists "Admins read own profile" on public.admin_profiles;
create policy "Admins read own profile" on public.admin_profiles for select to authenticated
  using (user_id = (select auth.uid()) and is_active);
drop policy if exists "Public reads site settings" on public.site_settings;
create policy "Public reads site settings" on public.site_settings for select
  using (true);

grant select on public.profiles, public.posts, public.likes, public.comments,
  public.post_tags, public.site_settings to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant insert, update, delete on public.posts to authenticated;
grant insert, delete on public.likes, public.saves to authenticated;
grant select, insert, delete on public.comments to authenticated;
grant select on public.saves, public.admin_profiles to authenticated;
grant all on public.admin_profiles, public.site_settings,
  public.admin_audit_logs, public.admin_login_attempts,
  public.admin_bootstrap_claims, public.admin_access_code to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-assets', 'site-assets', true, 10485760,
  array['image/png','image/jpeg','image/webp','video/mp4'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Public reads site assets'
  ) then
    create policy "Public reads site assets" on storage.objects for select
      using (bucket_id = 'site-assets');
  end if;
end;
$$;

do $$
declare
  required_table text;
  required_column text;
  required_function text;
  function_oid regprocedure;
  missing_columns text[] := array[]::text[];
  relation_name text;
begin
  foreach required_table in array array[
    'profiles', 'posts', 'likes', 'saves', 'comments', 'post_tags',
    'admin_profiles', 'site_settings', 'admin_audit_logs',
    'admin_login_attempts', 'admin_bootstrap_claims', 'admin_access_code'
  ] loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'Required VELORI relation public.% is missing after backend contract repair', required_table;
    end if;
  end loop;

  foreach required_column in array array[
    'profiles.id', 'profiles.username', 'profiles.display_name', 'profiles.bio',
    'profiles.avatar_url', 'profiles.is_private', 'posts.id', 'posts.author_id',
    'posts.body', 'posts.created_at', 'likes.user_id', 'likes.post_id',
    'saves.user_id', 'saves.post_id', 'comments.id', 'comments.post_id',
    'comments.author_id', 'comments.parent_id', 'comments.body',
    'post_tags.post_id', 'post_tags.tag', 'site_settings.id',
    'site_settings.error_404_enabled', 'site_settings.startup_animation_url',
    'site_settings.error_animation_url', 'site_settings.maintenance_mode',
    'admin_profiles.user_id', 'admin_profiles.role', 'admin_profiles.is_active',
    'admin_audit_logs.action', 'admin_login_attempts.email_hash'
  ] loop
    relation_name := split_part(required_column, '.', 1);
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = relation_name
        and column_name = split_part(required_column, '.', 2)
    ) then
      missing_columns := array_append(missing_columns, required_column);
    end if;
  end loop;

  if cardinality(missing_columns) > 0 then
    raise exception 'Required VELORI columns are missing: %', array_to_string(missing_columns, ', ');
  end if;

  foreach relation_name in array array[
    'profiles', 'posts', 'likes', 'saves', 'comments', 'post_tags',
    'admin_profiles', 'site_settings', 'admin_audit_logs', 'admin_login_attempts',
    'admin_bootstrap_claims', 'admin_access_code'
  ] loop
    if not (
      select c.relrowsecurity from pg_class c
      where c.oid = to_regclass('public.' || relation_name)
    ) then
      raise exception 'Row-level security is not enabled for public.%', relation_name;
    end if;
  end loop;

  if not exists (select 1 from storage.buckets where id = 'site-assets' and public) then
    raise exception 'The public-read site-assets bucket is missing.';
  end if;

  foreach required_function in array array[
    'public.admin_user_totals()',
    'public.admin_user_list(text,integer,integer)',
    'public.admin_user_count(text)',
    'public.admin_table_health()',
    'public.admin_prune_login_attempts(integer)',
    'public.admin_bootstrap_claim()',
    'public.admin_bootstrap_settle(boolean,uuid)',
    'public.admin_access_code_status()',
    'public.admin_set_access_code(text,integer,uuid,boolean)'
  ] loop
    function_oid := to_regprocedure(required_function);
    if function_oid is null then
      raise exception 'Required admin RPC % is missing after backend contract repair', required_function;
    end if;
    if has_function_privilege('anon', function_oid, 'EXECUTE')
       or has_function_privilege('authenticated', function_oid, 'EXECUTE') then
      raise exception 'Admin RPC % is executable by an unprivileged role', required_function;
    end if;
    if not has_function_privilege('service_role', function_oid, 'EXECUTE') then
      raise exception 'service_role cannot execute admin RPC %', required_function;
    end if;
  end loop;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.admin_profiles'::regclass
      and tgname = 'admin_profiles_protect_last_super'
      and not tgisinternal
  ) then
    raise exception 'Last-super-admin protection trigger is missing.';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'site_settings'
      and policyname = 'Public reads site settings'
  ) then
    raise exception 'Public site settings read policy is missing.';
  end if;
end;
$$;
