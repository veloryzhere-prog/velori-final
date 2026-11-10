-- VELORYZ administrator, settings, storage, and audit schema.
-- Review and apply after the core migration. The first administrator is bootstrapped manually.
do $$
begin
  create type public.admin_role as enum ('admin', 'super_admin');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.admin_role not null default 'admin',
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  job_title text not null default '' check (char_length(job_title) <= 100),
  bio text not null default '' check (char_length(bio) <= 500),
  avatar_url text,
  is_active boolean not null default true,
  mfa_required boolean not null default false,
  session_timeout_minutes integer not null default 60 check (session_timeout_minutes between 15 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id boolean primary key default true check (id),
  site_name text not null default 'VELORYZ' check (char_length(site_name) between 1 and 80),
  site_title text not null default 'VELORI by VELORYZ Studios' check (char_length(site_title) between 1 and 120),
  logo_url text not null default '/veloryz-official.svg',
  favicon_url text,
  contact_email text,
  contact_phone text,
  website_url text,
  footer_text text not null default 'A VELORYZ Studios product' check (char_length(footer_text) <= 240),
  announcement_text text not null default '' check (char_length(announcement_text) <= 300),
  maintenance_mode boolean not null default false,
  homepage_kicker text not null default 'YOUR CORNER OF THE INTERNET' check (char_length(homepage_kicker) <= 120),
  theme_accent text not null default 'rose' check (theme_accent in ('rose', 'blue', 'cyan')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 100),
  target_type text not null check (char_length(target_type) between 1 and 80),
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  error_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_login_attempts (
  id bigint generated always as identity primary key,
  email_hash text not null,
  ip_address inet,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_admin_idx on public.admin_audit_logs (admin_user_id, created_at desc);
create index if not exists admin_login_attempts_rate_idx on public.admin_login_attempts (email_hash, created_at desc);
create index if not exists admin_profiles_active_idx on public.admin_profiles (is_active) where is_active;

alter table public.admin_profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.admin_login_attempts enable row level security;

-- Browser clients can read only the active administrator's own non-secret profile.
drop policy if exists "Admins read own profile" on public.admin_profiles;
create policy "Admins read own profile" on public.admin_profiles for select to authenticated
  using (user_id = (select auth.uid()) and is_active);
drop policy if exists "Public reads site settings" on public.site_settings;
create policy "Public reads site settings" on public.site_settings for select
  using (true);
-- Mutations and audit access are intentionally service-role-only through the Edge Function.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-assets', 'site-assets', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads site assets" on storage.objects;
create policy "Public reads site assets" on storage.objects for select
  using (bucket_id = 'site-assets');
-- Uploads are performed by the server after validation; there is no browser insert policy.

-- The first super administrator is created through the protected Edge
-- Function bootstrap after migrations 040 and 070 are applied. Do not insert
-- an administrator row manually or place credentials in SQL/source control.
