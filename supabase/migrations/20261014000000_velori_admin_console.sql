-- VELORI admin console configuration: branding assets, motion, theme, error pages,
-- advertisements, system notifications, platform settings, email template metadata
-- and the application route registry.
--
-- Split of responsibility with `site_settings`
-- ------------------------------------------
-- `site_settings` (20261002) is the singleton the existing public shell already
-- reads directly: site name/title, logo, favicon, contact details, footer,
-- maintenance_mode, homepage kicker, error_404_enabled and the two animation URLs.
-- Those columns are NOT duplicated here, because two sources of truth for
-- maintenance mode would let the panel and the app disagree. `platform_settings`
-- holds only the settings that do not yet exist anywhere.

-- ---------------------------------------------------------------------------
-- 1. Branding assets with version history
-- ---------------------------------------------------------------------------

create table if not exists public.branding_assets (
  id uuid primary key default gen_random_uuid(),
  slot text not null unique check (slot in (
    'main_logo', 'veloryz_logo', 'light_logo', 'dark_logo', 'mobile_logo',
    'favicon', 'app_icon', 'loading_logo', 'login_logo', 'email_logo'
  )),
  label text not null check (char_length(trim(label)) between 1 and 80),
  object_path text not null default '',
  public_url text not null default '',
  mime_type text not null default '' check (char_length(mime_type) <= 120),
  byte_size bigint not null default 0 check (byte_size >= 0),
  is_active boolean not null default true,
  version integer not null default 1 check (version >= 1),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.branding_assets is
  'One active asset per branding slot. Replacing a slot bumps `version` and the previous object stays reachable through branding_asset_versions, so the working logo is never destroyed before the replacement is validated.';

create table if not exists public.branding_asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.branding_assets(id) on delete cascade,
  version integer not null check (version >= 1),
  object_path text not null default '',
  public_url text not null default '',
  mime_type text not null default '',
  byte_size bigint not null default 0,
  note text not null default '' check (char_length(note) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (asset_id, version)
);

create index if not exists branding_asset_versions_asset_idx on public.branding_asset_versions (asset_id, version desc);

insert into public.branding_assets (slot, label, public_url, is_active)
values
  ('main_logo', 'Main VELORI logo', '/veloryz-official.svg', true),
  ('veloryz_logo', 'VELORYZ studio logo', '/veloryz-official.svg', true)
on conflict (slot) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Motion system
-- ---------------------------------------------------------------------------

create table if not exists public.animation_configs (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z_]+$'),
  label text not null check (char_length(trim(label)) between 1 and 80),
  category text not null default 'page' check (category in ('page', 'overlay', 'loading', 'brand', 'interaction', 'background', 'state')),
  enabled boolean not null default true,
  animation_type text not null default 'fade' check (animation_type in (
    'none', 'fade', 'fade_up', 'fade_down', 'slide_left', 'slide_right',
    'scale', 'pop', 'blur', 'shimmer', 'pulse', 'drift', 'ken_burns'
  )),
  duration_ms integer not null default 320 check (duration_ms between 0 and 30000),
  intensity integer not null default 50 check (intensity between 0 and 100),
  delay_ms integer not null default 0 check (delay_ms between 0 and 2000),
  easing text not null default 'ease-out' check (easing in ('linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'spring')),
  respect_reduced_motion boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Existing installations may have created the table before this migration was
-- corrected. `CREATE TABLE IF NOT EXISTS` does not update its checks or defaults,
-- so explicitly reconcile both constraints before inserting the long-running
-- background and hero animations below.
alter table public.animation_configs
  alter column category set default 'page';

alter table public.animation_configs
  drop constraint if exists animation_configs_duration_ms_check;

alter table public.animation_configs
  add constraint animation_configs_duration_ms_check
  check (duration_ms between 0 and 30000);

comment on table public.animation_configs is
  'Per-surface motion configuration. `respect_reduced_motion` marks a surface as essential; nonessential surfaces collapse to a near-zero duration when the admin Reduce Motion Safe Mode or the visitor''s own prefers-reduced-motion setting is active.';

insert into public.animation_configs (key, label, category, enabled, animation_type, duration_ms, intensity, delay_ms, easing, respect_reduced_motion)
values
  ('page_enter', 'Page entrance', 'page', true, 'fade_up', 320, 40, 0, 'ease-out', false),
  ('page_exit', 'Page exit', 'page', true, 'fade_down', 240, 30, 0, 'ease-in', false),
  ('modal_enter', 'Modal animation', 'overlay', true, 'pop', 220, 45, 0, 'spring', false),
  ('navigation_transition', 'Navigation animation', 'page', true, 'slide_right', 260, 35, 0, 'ease-out', false),
  ('loading', 'Loading animation', 'loading', true, 'pulse', 900, 40, 0, 'ease-in-out', true),
  ('logo', 'Logo animation', 'brand', true, 'fade', 600, 30, 0, 'ease-out', false),
  ('skeleton', 'Skeleton animation', 'loading', true, 'shimmer', 1200, 35, 0, 'linear', false),
  ('button_hover', 'Button interaction', 'interaction', true, 'scale', 140, 25, 0, 'ease-out', false),
  ('background_motion', 'Background motion', 'background', true, 'drift', 18000, 25, 0, 'linear', false),
  ('hero_motion', 'Hero motion', 'background', true, 'ken_burns', 14000, 30, 0, 'linear', false),
  ('empty_state', 'Empty-state animation', 'state', true, 'fade_up', 300, 30, 40, 'ease-out', false)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Platform-wide theme
-- ---------------------------------------------------------------------------

create table if not exists public.theme_settings (
  id boolean primary key default true check (id),
  primary_color text not null default '#ff5c8a' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color text not null default '#7c5cff' check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_color text not null default '#3ba7ff' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  background_color text not null default '#fbfafb' check (background_color ~ '^#[0-9a-fA-F]{6}$'),
  surface_color text not null default '#ffffff' check (surface_color ~ '^#[0-9a-fA-F]{6}$'),
  text_color text not null default '#141018' check (text_color ~ '^#[0-9a-fA-F]{6}$'),
  muted_text_color text not null default '#6b6472' check (muted_text_color ~ '^#[0-9a-fA-F]{6}$'),
  border_radius integer not null default 18 check (border_radius between 0 and 48),
  shadow_level text not null default 'soft' check (shadow_level in ('none', 'soft', 'medium', 'bold')),
  glass_effects boolean not null default true,
  heading_font text not null default 'Plus Jakarta Sans' check (char_length(heading_font) <= 80),
  body_font text not null default 'Plus Jakarta Sans' check (char_length(body_font) <= 80),
  button_style text not null default 'rounded' check (button_style in ('rounded', 'pill', 'square', 'soft')),
  card_style text not null default 'elevated' check (card_style in ('flat', 'outlined', 'elevated', 'glass')),
  navigation_style text not null default 'sidebar' check (navigation_style in ('sidebar', 'topbar', 'minimal')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.theme_settings is
  'Platform appearance. The Edge Function rejects a colour pair whose relative luminance contrast falls below the legibility floor, so an administrator cannot publish unreadable text.';

insert into public.theme_settings (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Error pages: extend the existing admin_error_pages table
-- ---------------------------------------------------------------------------

alter table public.admin_error_pages
  add column if not exists heading text not null default '',
  add column if not exists animation_key text not null default '' check (char_length(animation_key) <= 40),
  add column if not exists show_logo boolean not null default true;

update public.admin_error_pages set heading = title where heading = '';

-- ---------------------------------------------------------------------------
-- 5. Advertisements
-- ---------------------------------------------------------------------------

create table if not exists public.advertisements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null default '' check (char_length(body) <= 600),
  image_url text not null default '',
  target_url text not null default '',
  placement text not null default 'feed' check (placement in ('feed', 'reels', 'stories', 'profile', 'search', 'groups')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'paused', 'ended')),
  priority integer not null default 0 check (priority between 0 and 100),
  audience jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  impression_count bigint not null default 0 check (impression_count >= 0),
  click_count bigint not null default 0 check (click_count >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

comment on table public.advertisements is
  'Sponsored placements. The public renderer always wraps an advertisement in an `aria-label`ed "Sponsored" region and marks it visually distinct, so an advertisement can never be mistaken for organic user content.';

create index if not exists advertisements_status_idx on public.advertisements (status, placement, priority desc);

-- ---------------------------------------------------------------------------
-- 6. System notifications (admin-composed, targeted at accounts)
-- ---------------------------------------------------------------------------
--
-- `system_announcements` is the public banner channel and is left as-is. This table is
-- the targeted in-app notification channel.

create table if not exists public.system_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  message text not null check (char_length(trim(message)) between 1 and 2000),
  icon text not null default '' check (char_length(icon) <= 60),
  link text not null default '' check (char_length(link) <= 300),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  audience text not null default 'all' check (audience in ('all', 'selected_users', 'account_types', 'roles', 'admins')),
  audience_ids uuid[] not null default '{}'::uuid[],
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  sent_at timestamptz,
  recipient_count integer not null default 0 check (recipient_count >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_notification_receipts (
  notification_id uuid not null references public.system_notifications(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  read_at timestamptz,
  primary key (notification_id, profile_id)
);

create index if not exists system_notifications_created_idx on public.system_notifications (created_at desc);

-- ---------------------------------------------------------------------------
-- 7. Platform settings (singleton; excludes anything already in site_settings)
-- ---------------------------------------------------------------------------

create table if not exists public.platform_settings (
  id boolean primary key default true check (id),

  registration_enabled boolean not null default true,
  email_verification_required boolean not null default true,
  default_private_accounts boolean not null default false,

  posting_enabled boolean not null default true,
  comments_enabled boolean not null default true,
  uploads_enabled boolean not null default true,
  messaging_enabled boolean not null default true,
  content_moderation_enabled boolean not null default true,

  max_upload_mb integer not null default 10 check (max_upload_mb between 1 and 100),
  max_post_chars integer not null default 2000 check (max_post_chars between 1 and 10000),
  max_comment_chars integer not null default 1000 check (max_comment_chars between 1 and 5000),
  max_reel_seconds integer not null default 90 check (max_reel_seconds between 1 and 600),
  max_story_count integer not null default 10 check (max_story_count between 1 and 50),
  posts_per_hour integer not null default 60 check (posts_per_hour between 1 and 1000),
  comments_per_hour integer not null default 120 check (comments_per_hour between 1 and 5000),

  username_min_length integer not null default 3 check (username_min_length between 3 and 24),
  username_max_length integer not null default 24 check (username_max_length between 3 and 30),

  default_language text not null default 'en' check (char_length(default_language) between 2 and 10),
  default_theme text not null default 'system' check (default_theme in ('system', 'light', 'dark')),
  reduce_motion_safe_mode boolean not null default false,
  emergency_mode boolean not null default false,
  emergency_message text not null default '' check (char_length(emergency_message) <= 400),

  require_admin_reauth_minutes integer not null default 10 check (require_admin_reauth_minutes between 1 and 120),
  admin_session_timeout_minutes integer not null default 60 check (admin_session_timeout_minutes between 5 and 1440),

  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (username_max_length >= username_min_length)
);

comment on table public.platform_settings is
  'Singleton platform policy. maintenance_mode deliberately lives in site_settings because the public shell already reads it; the settings API writes it there rather than shadowing it here.';

insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Email template metadata (no credentials, ever)
-- ---------------------------------------------------------------------------

create table if not exists public.email_template_configs (
  key text primary key check (key in (
    'confirm_signup', 'invite_user', 'password_reset', 'email_change',
    'otp', 'login_alert', 'security_alert', 'admin_announcement'
  )),
  label text not null check (char_length(trim(label)) between 1 and 80),
  subject text not null default '' check (char_length(subject) <= 200),
  heading text not null default '' check (char_length(heading) <= 200),
  body_html text not null default '',
  body_text text not null default '',
  enabled boolean not null default true,
  version integer not null default 1 check (version >= 1),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.email_template_configs is
  'Editable copy and activation state for transactional email. SMTP host, username and password are Edge Function secrets and are never stored here or returned by any endpoint.';

create table if not exists public.email_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_key text not null references public.email_template_configs(key) on delete cascade,
  version integer not null check (version >= 1),
  subject text not null default '',
  heading text not null default '',
  body_html text not null default '',
  body_text text not null default '',
  note text not null default '' check (char_length(note) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_key, version)
);

insert into public.email_template_configs (key, label, subject, heading, enabled)
values
  ('confirm_signup', 'Confirm signup', 'Confirm your VELORI account', 'Welcome to VELORI', true),
  ('invite_user', 'Invite user', 'You have been invited to VELORI', 'You are invited', true),
  ('password_reset', 'Password reset', 'Reset your VELORI password', 'Reset your password', true),
  ('email_change', 'Email change', 'Confirm your new VELORI email address', 'Confirm your new email', true),
  ('otp', 'One-time passcode', 'Your VELORI passcode', 'Your passcode', true),
  ('login_alert', 'Login alert', 'New sign-in to your VELORI account', 'New sign-in detected', true),
  ('security_alert', 'Security alert', 'Security alert for your VELORI account', 'Security alert', true),
  ('admin_announcement', 'Admin announcement', 'An update from the VELORI team', 'Announcement', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 9. Route registry
-- ---------------------------------------------------------------------------
--
-- Seeded from the routes actually registered in src/app/routes.tsx, not from an
-- assumed list. `group` and `label` are what the Route Manager screen displays.

create table if not exists public.app_routes (
  path text primary key check (char_length(trim(path)) between 1 and 180),
  label text not null check (char_length(trim(label)) between 1 and 80),
  route_group text not null default 'other' check (route_group in ('admin', 'feed', 'content', 'profile', 'settings', 'auth', 'legal', 'pending', 'utility', 'other')),
  description text not null default '' check (char_length(description) <= 300),
  enabled boolean not null default true,
  requires_auth boolean not null default false,
  is_public_page boolean not null default false,
  maintenance_override boolean not null default false,
  meta_title text not null default '' check (char_length(meta_title) <= 200),
  meta_description text not null default '' check (char_length(meta_description) <= 400),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.app_routes (path, label, route_group, description, requires_auth, is_public_page)
values
  ('/', 'Home feed', 'feed', 'Landing and feed entry point.', false, true),
  ('/home', 'Home', 'feed', 'Primary signed-in feed.', true, false),
  ('/feed', 'Feed', 'feed', 'Alias of the home feed.', true, false),
  ('/explore', 'Explore', 'content', 'Discovery surface.', false, true),
  ('/search', 'Search', 'content', 'Global search.', false, true),
  ('/people', 'People', 'content', 'People search.', false, true),
  ('/hashtags/:tag', 'Hashtag', 'content', 'Hashtag landing page.', false, true),
  ('/post/:id', 'Post detail', 'content', 'Single post with comments.', false, true),
  ('/saved', 'Saved posts', 'profile', 'Bookmarked posts.', true, false),
  ('/archive', 'Archive', 'profile', 'Archived posts.', true, false),
  ('/trash', 'Trash', 'profile', 'Deleted posts awaiting purge.', true, false),
  ('/drafts', 'Drafts', 'profile', 'Post drafts.', true, false),
  ('/create', 'Create post', 'content', 'Composer.', true, false),
  ('/profile/:username', 'Profile', 'profile', 'User profile.', false, true),
  ('/settings', 'Settings', 'settings', 'Account settings root.', true, false),
  ('/settings/appearance', 'Appearance settings', 'settings', 'Theme and motion preferences.', true, false),
  ('/settings/account', 'Account settings', 'settings', 'Account details.', true, false),
  ('/settings/follow-requests', 'Follow requests', 'settings', 'Incoming follow requests.', true, false),
  ('/login', 'Sign in', 'auth', 'Sign-in form.', false, true),
  ('/signup', 'Create account', 'auth', 'Registration form.', false, true),
  ('/forgot-password', 'Forgot password', 'auth', 'Account recovery request.', false, true),
  ('/reset-password', 'Reset password', 'auth', 'Sets a new password from a recovery link.', false, true),
  ('/auth/check-email', 'Check your email', 'auth', 'Post-signup verification notice.', false, true),
  ('/auth/confirm', 'Confirm account', 'auth', 'Processes the signup confirmation token.', false, true),
  ('/auth/confirmed', 'Account confirmed', 'auth', 'Confirmation success notice.', false, true),
  ('/verify-email', 'Verify email', 'auth', 'Resend verification.', false, true),
  ('/onboarding', 'Onboarding', 'profile', 'First-run profile setup.', true, false),
  ('/help', 'Help centre', 'utility', 'Support content.', false, true),
  ('/maintenance', 'Maintenance', 'utility', 'Maintenance notice page.', false, true),
  ('/about', 'About', 'legal', 'About VELORI.', false, true),
  ('/contact', 'Contact', 'legal', 'Contact details.', false, true),
  ('/privacy', 'Privacy policy', 'legal', 'Privacy policy.', false, true),
  ('/terms', 'Terms of service', 'legal', 'Terms of service.', false, true),
  ('/community-guidelines', 'Community guidelines', 'legal', 'Community guidelines.', false, true),
  ('/safety', 'Safety', 'legal', 'Safety centre.', false, true),
  ('/cookies', 'Cookie policy', 'legal', 'Cookie policy.', false, true),
  ('/acceptable-use', 'Acceptable use', 'legal', 'Acceptable use policy.', false, true),
  ('/data-policy', 'Data policy', 'legal', 'Data handling policy.', false, true),
  ('/legal', 'Legal index', 'legal', 'Legal document index.', false, true),
  ('/messages', 'Messages', 'pending', 'Messaging surface.', true, false),
  ('/notifications', 'Notifications', 'pending', 'Notification surface.', true, false),
  ('/stories', 'Stories', 'pending', 'Stories surface.', true, false),
  ('/reels', 'Reels', 'pending', 'Reels surface.', true, false),
  ('/groups', 'Groups', 'pending', 'Groups surface.', true, false),
  ('/admin', 'Admin entry', 'admin', 'Redirects to the dashboard or sign-in.', false, false),
  ('/admin/login', 'Admin sign-in', 'admin', 'Administrator sign-in.', false, false),
  ('/admin/dashboard', 'Admin overview', 'admin', 'Administrator dashboard.', true, false),
  ('/admin/users', 'Admin users', 'admin', 'User management.', true, false),
  ('/admin/users/:id', 'Admin user detail', 'admin', 'Single account management.', true, false),
  ('/admin/posts', 'Admin posts', 'admin', 'Post moderation.', true, false),
  ('/admin/reels', 'Admin reels', 'admin', 'Reel moderation.', true, false),
  ('/admin/stories', 'Admin stories', 'admin', 'Story moderation.', true, false),
  ('/admin/comments', 'Admin comments', 'admin', 'Comment moderation.', true, false),
  ('/admin/reports', 'Admin reports', 'admin', 'Moderation queue.', true, false),
  ('/admin/groups', 'Admin groups', 'admin', 'Group moderation.', true, false),
  ('/admin/messages', 'Admin message reports', 'admin', 'Message abuse reports.', true, false),
  ('/admin/cms', 'Admin CMS', 'admin', 'Page manager.', true, false),
  ('/admin/pages', 'Admin pages', 'admin', 'Page manager.', true, false),
  ('/admin/pages/:id', 'Admin page editor', 'admin', 'Single page editor and versions.', true, false),
  ('/admin/routes', 'Admin routes', 'admin', 'Route registry.', true, false),
  ('/admin/navigation', 'Admin navigation', 'admin', 'Navigation manager.', true, false),
  ('/admin/branding', 'Admin branding', 'admin', 'Logo and favicon manager.', true, false),
  ('/admin/animations', 'Admin animations', 'admin', 'Motion manager.', true, false),
  ('/admin/appearance', 'Admin appearance', 'admin', 'Theme manager.', true, false),
  ('/admin/error-pages', 'Admin error pages', 'admin', 'Error page manager.', true, false),
  ('/admin/notifications', 'Admin notifications', 'admin', 'Announcements and system notifications.', true, false),
  ('/admin/ads', 'Admin ads', 'admin', 'Advertisement manager.', true, false),
  ('/admin/settings', 'Admin settings', 'admin', 'Platform settings.', true, false),
  ('/admin/security', 'Admin security', 'admin', 'Security and emergency controls.', true, false),
  ('/admin/admins', 'Admin administrators', 'admin', 'Administrator accounts.', true, false),
  ('/admin/roles', 'Admin roles', 'admin', 'Roles and permissions.', true, false),
  ('/admin/sessions', 'Admin sessions', 'admin', 'Active administrator sessions.', true, false),
  ('/admin/audit-logs', 'Admin audit log', 'admin', 'Administrator action log.', true, false),
  ('/admin/emails', 'Admin email templates', 'admin', 'Email template manager.', true, false),
  ('/admin/storage', 'Admin storage', 'admin', 'Storage diagnostics.', true, false),
  ('/admin/system', 'Admin system', 'admin', 'Health, version and export.', true, false)
on conflict (path) do nothing;

-- ---------------------------------------------------------------------------
-- 10. Service-role only
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'branding_assets', 'branding_asset_versions', 'animation_configs',
    'theme_settings', 'advertisements', 'system_notifications',
    'system_notification_receipts', 'platform_settings',
    'email_template_configs', 'email_template_versions', 'app_routes'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end;
$$;

grant select on public.admin_error_pages to service_role;
grant all on public.admin_error_pages to service_role;
