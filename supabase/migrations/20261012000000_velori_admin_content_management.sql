-- VELORI content-moderation and admin configuration layer.
-- Reuses the working admin/auth foundation. These tables capture real state for
-- CMS pages, feature flags, navigation, public announcements and moderation.

alter table public.profiles
  add column if not exists is_verified boolean not null default false,
  add column if not exists is_banned boolean not null default false,
  add column if not exists is_suspended boolean not null default false,
  add column if not exists is_restricted boolean not null default false,
  add column if not exists moderation_notes text not null default '';

alter table public.posts
  add column if not exists is_hidden boolean not null default false,
  add column if not exists moderation_reason text not null default '',
  add column if not exists moderated_by uuid references auth.users(id) on delete set null,
  add column if not exists moderated_at timestamptz;

alter table public.comments
  add column if not exists is_hidden boolean not null default false,
  add column if not exists moderation_reason text not null default '',
  add column if not exists moderated_by uuid references auth.users(id) on delete set null,
  add column if not exists moderated_at timestamptz;

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment', 'profile', 'story', 'reel', 'group', 'message')),
  target_id uuid not null,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  category text not null default 'other' check (category in ('spam', 'harassment', 'impersonation', 'hate', 'dangerous', 'copyright', 'privacy', 'scam', 'fake_account', 'other')),
  reason text not null default '' check (char_length(reason) <= 2000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'action_taken', 'no_violation', 'closed')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  slug text not null unique check (char_length(trim(slug)) between 1 and 120),
  route text not null unique check (char_length(trim(route)) between 1 and 180),
  status text not null default 'draft' check (status in ('draft', 'published', 'scheduled', 'disabled')),
  content text not null default '',
  seo_title text default '',
  seo_description text default '',
  og_title text default '',
  og_description text default '',
  og_image text default '',
  hero_image text default '',
  footer_enabled boolean not null default true,
  animation_enabled boolean not null default true,
  published_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.cms_pages(id) on delete cascade,
  version_label text not null default 'v1',
  title text not null,
  slug text not null,
  route text not null,
  content text not null default '',
  seo_title text default '',
  seo_description text default '',
  og_title text default '',
  og_description text default '',
  hero_image text default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.navigation_items (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(trim(label)) between 1 and 80),
  route text not null check (char_length(trim(route)) between 1 and 180),
  icon text default '',
  position integer not null default 0,
  visible boolean not null default true,
  desktop_visible boolean not null default true,
  mobile_visible boolean not null default true,
  required_role text not null default 'all' check (required_role in ('all', 'admin', 'super_admin', 'moderator', 'content_manager', 'support')),
  feature_flag text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  rollout integer not null default 0 check (rollout between 0 and 100),
  roles text[] not null default '{}'::text[],
  description text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.system_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  message text not null check (char_length(trim(message)) between 1 and 2000),
  icon text default '',
  link text default '',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  audience text not null default 'all' check (audience in ('all', 'selected_users', 'account_types', 'roles')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  dismissible boolean not null default true,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_error_pages (
  code text primary key check (code in ('404', '403', '429', '500', 'maintenance', 'network', 'generic')),
  title text not null default '',
  description text not null default '',
  image_url text default '',
  logo_url text default '',
  button_label text default 'Return home',
  button_url text default '/home',
  background text default '',
  enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists content_reports_status_idx on public.content_reports (status, created_at desc);
create index if not exists content_reports_target_idx on public.content_reports (target_type, target_id);
create index if not exists cms_pages_status_idx on public.cms_pages (status, updated_at desc);
create index if not exists navigation_items_position_idx on public.navigation_items (position, visible);
create index if not exists feature_flags_updated_idx on public.feature_flags (updated_at desc);
create index if not exists announcements_active_idx on public.system_announcements (active, starts_at, ends_at);

alter table public.content_reports enable row level security;
alter table public.cms_pages enable row level security;
alter table public.cms_page_versions enable row level security;
alter table public.navigation_items enable row level security;
alter table public.feature_flags enable row level security;
alter table public.system_announcements enable row level security;
alter table public.admin_error_pages enable row level security;

-- These are server-managed admin tables. Browser clients may not mutate them directly.
-- service_role bypasses RLS, so these policies exist only to document the intended
-- boundary. Every name is dropped first: this file must be safe to re-run after a
-- partial apply, which a bare `create policy` is not.
drop policy if exists "Service-role manages content reports" on public.content_reports;
drop policy if exists "Service-role manages cms pages" on public.cms_pages;
drop policy if exists "Service-role manages cms versions" on public.cms_page_versions;
drop policy if exists "Service-role manages navigation" on public.navigation_items;
drop policy if exists "Service-role manages feature flags" on public.feature_flags;
drop policy if exists "Service-role manages announcements" on public.system_announcements;
drop policy if exists "Service-role manages error pages" on public.admin_error_pages;

create policy "Service-role manages content reports" on public.content_reports for all to service_role using (true) with check (true);
create policy "Service-role manages cms pages" on public.cms_pages for all to service_role using (true) with check (true);
create policy "Service-role manages cms versions" on public.cms_page_versions for all to service_role using (true) with check (true);
create policy "Service-role manages navigation" on public.navigation_items for all to service_role using (true) with check (true);
create policy "Service-role manages feature flags" on public.feature_flags for all to service_role using (true) with check (true);
create policy "Service-role manages announcements" on public.system_announcements for all to service_role using (true) with check (true);
create policy "Service-role manages error pages" on public.admin_error_pages for all to service_role using (true) with check (true);

-- Seed sane defaults for the public-facing admin-controlled modules.
insert into public.feature_flags (key, enabled, rollout, roles, description)
values
  ('reels_enabled', true, 100, '{}', 'Enable reels in the public app'),
  ('stories_enabled', true, 100, '{}', 'Enable stories in the public app'),
  ('groups_enabled', true, 100, '{}', 'Enable groups in the public app'),
  ('messaging_enabled', true, 100, '{}', 'Enable messaging features'),
  ('ads_enabled', false, 0, '{}', 'Enable advertisements'),
  ('creator_tools_enabled', true, 100, '{}', 'Enable creator and creator dashboard tools'),
  ('profile_qr_enabled', false, 0, '{}', 'Enable profile QR features'),
  ('new_home_feed', true, 100, '{}', 'Use the new home feed experience'),
  ('experimental_ui', false, 0, '{}', 'Enable experimental interface features')
on conflict (key) do nothing;

insert into public.admin_error_pages (code, title, description, button_label, button_url, enabled)
values
  ('404', 'Page not found', 'This page is unavailable or has moved. Try returning home to continue exploring.', 'Return home', '/home', true),
  ('403', 'Access denied', 'You do not have permission to view that page.', 'Back to safety', '/home', true),
  ('429', 'Too many requests', 'We received too many requests from this device. Please wait a moment and try again.', 'Try again', '/home', true),
  ('500', 'Something went wrong', 'The platform encountered an unexpected error. Please try again shortly.', 'Refresh page', '/home', true),
  ('maintenance', 'Maintenance mode', 'VELORI is temporarily unavailable while we complete platform work.', 'Check back soon', '/home', true),
  ('network', 'Connection issue', 'Your device appears to be offline or the connection is unstable right now.', 'Retry', '/home', true),
  ('generic', 'We are having trouble', 'Something unexpected happened while loading this page. Please try again in a moment.', 'Go home', '/home', true)
on conflict (code) do nothing;

insert into public.navigation_items (id, label, route, icon, position, visible, desktop_visible, mobile_visible, required_role, feature_flag)
values
  ('1d0d0d0d-0000-4000-8000-000000000001', 'Overview', '/admin/dashboard', 'layout-dashboard', 0, true, true, false, 'all', ''),
  ('1d0d0d0d-0000-4000-8000-000000000002', 'Users', '/admin/users', 'users', 1, true, true, true, 'all', ''),
  ('1d0d0d0d-0000-4000-8000-000000000003', 'Posts', '/admin/posts', 'file-text', 2, true, true, true, 'all', 'new_home_feed'),
  ('1d0d0d0d-0000-4000-8000-000000000004', 'Reports', '/admin/reports', 'flag', 3, true, true, true, 'all', ''),
  ('1d0d0d0d-0000-4000-8000-000000000005', 'CMS', '/admin/cms', 'layout', 4, true, true, true, 'content_manager', ''),
  ('1d0d0d0d-0000-4000-8000-000000000006', 'Branding', '/admin/branding', 'palette', 5, true, true, true, 'content_manager', ''),
  ('1d0d0d0d-0000-4000-8000-000000000007', 'Settings', '/admin/settings', 'settings', 6, true, true, true, 'admin', '')
on conflict (id) do nothing;
