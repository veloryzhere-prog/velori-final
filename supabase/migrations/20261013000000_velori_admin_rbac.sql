-- VELORI admin RBAC, sessions, audit enrichment, and the browser read boundary
-- for the admin-controlled configuration tables.
--
-- Why this file exists
-- --------------------
-- 1. `admin_profiles.role` is a two-value enum (`admin`, `super_admin`). The control
--    centre needs five roles with individually assignable permissions. The enum is
--    left untouched (ALTER TYPE ... ADD VALUE cannot be relied on inside the same
--    transaction that uses the new value) and a `role_key` column is added instead,
--    kept in sync with the legacy enum by a trigger so existing Edge Function checks
--    that compare `role = 'super_admin'` keep working.
-- 2. `admin_audit_logs` has no `reason` and no `result`, so destructive actions could
--    not record why they happened or whether they succeeded.
-- 3. There was no server-side session record, so admin sessions could not be listed,
--    expired, or revoked individually.
-- 4. The 20261012 tables (`feature_flags`, `navigation_items`,
--    `system_announcements`, `cms_pages`) were created service-role-only, but the
--    browser reads all four directly. Every one of those reads was therefore
--    guaranteed to fail and silently fall back to compiled defaults, which made the
--    whole admin-controlled configuration layer inert in the running app. This file
--    adds the narrow read-only policies and table grants that fix that.

-- ---------------------------------------------------------------------------
-- 1. Roles
-- ---------------------------------------------------------------------------

create table if not exists public.admin_roles (
  key text primary key check (key in ('super_admin', 'admin', 'moderator', 'content_manager', 'support')),
  label text not null check (char_length(trim(label)) between 1 and 60),
  description text not null default '' check (char_length(description) <= 400),
  rank integer not null check (rank between 0 and 100),
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.admin_roles is
  'Administrator roles. Managed by migration seed; rows are system-owned and cannot be deleted.';

insert into public.admin_roles (key, label, description, rank)
values
  ('super_admin', 'Super Admin', 'Full platform control including security configuration, administrator management and emergency mode.', 100),
  ('admin', 'Admin', 'Platform management excluding the highest-risk security and configuration operations.', 80),
  ('moderator', 'Moderator', 'User, content and report moderation only.', 60),
  ('content_manager', 'Content Manager', 'CMS pages, banners, announcements and branding assets.', 40),
  ('support', 'Support', 'User support and account diagnostics with read-mostly access.', 20)
on conflict (key) do update
  set label = excluded.label,
      description = excluded.description,
      rank = excluded.rank;

-- ---------------------------------------------------------------------------
-- 2. Permissions
-- ---------------------------------------------------------------------------

create table if not exists public.admin_permissions (
  key text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  category text not null check (char_length(trim(category)) between 1 and 40),
  label text not null check (char_length(trim(label)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 400),
  risk text not null default 'standard' check (risk in ('standard', 'elevated', 'critical')),
  sort_order integer not null default 0
);

comment on table public.admin_permissions is
  'Individually assignable administrator permissions. Hiding a UI control is never the enforcement point; the Edge Function checks these keys.';

create table if not exists public.admin_role_permissions (
  role_key text not null references public.admin_roles(key) on delete cascade,
  permission_key text not null references public.admin_permissions(key) on delete cascade,
  primary key (role_key, permission_key)
);

insert into public.admin_permissions (key, category, label, description, risk, sort_order)
values
  ('users.view', 'Users', 'View users', 'List and search accounts and open user detail.', 'standard', 10),
  ('users.edit', 'Users', 'Edit users', 'Change permitted profile metadata on an account.', 'elevated', 11),
  ('users.verify', 'Users', 'Verify accounts', 'Grant or remove verification badges.', 'elevated', 12),
  ('users.restrict', 'Users', 'Restrict accounts', 'Apply a posting or commenting restriction.', 'elevated', 13),
  ('users.suspend', 'Users', 'Suspend accounts', 'Temporarily disable an account.', 'elevated', 14),
  ('users.ban', 'Users', 'Ban accounts', 'Permanently disable an account and its sessions.', 'critical', 15),
  ('users.notes', 'Users', 'Edit moderation notes', 'Add and remove administrator notes on an account.', 'standard', 16),
  ('users.sessions', 'Users', 'Force sign-out', 'Revoke an account sessions from the user detail screen.', 'elevated', 17),
  ('users.delete', 'Users', 'Delete accounts', 'Permanently delete an account and its data.', 'critical', 18),

  ('posts.view', 'Content', 'View posts', 'List and search posts.', 'standard', 20),
  ('posts.hide', 'Content', 'Hide posts', 'Take a post out of circulation without deleting it.', 'elevated', 21),
  ('posts.restore', 'Content', 'Restore posts', 'Return a hidden post to circulation.', 'elevated', 22),
  ('posts.delete', 'Content', 'Delete posts', 'Delete a post and its media references.', 'critical', 23),

  ('comments.view', 'Content', 'View comments', 'List and search comments.', 'standard', 24),
  ('comments.hide', 'Content', 'Hide comments', 'Hide a comment without deleting it.', 'elevated', 25),
  ('comments.restore', 'Content', 'Restore comments', 'Return a hidden comment to view.', 'elevated', 26),
  ('comments.delete', 'Content', 'Delete comments', 'Permanently delete a comment.', 'elevated', 27),

  ('reports.view', 'Reports', 'View reports', 'Read the moderation queue.', 'standard', 28),
  ('reports.update', 'Reports', 'Update reports', 'Move a report through its lifecycle.', 'elevated', 29),

  ('cms.view', 'CMS', 'View pages', 'List CMS pages and their versions.', 'standard', 30),
  ('cms.edit', 'CMS', 'Edit pages', 'Create, edit, duplicate and version CMS pages.', 'standard', 31),
  ('cms.publish', 'CMS', 'Publish pages', 'Publish, unpublish and schedule CMS pages.', 'elevated', 32),
  ('cms.delete', 'CMS', 'Delete pages', 'Delete or restore CMS pages.', 'elevated', 33),

  ('navigation.view', 'Navigation', 'View navigation', 'Read the navigation registry.', 'standard', 34),
  ('navigation.edit', 'Navigation', 'Edit navigation', 'Create, edit, reorder and hide navigation entries.', 'standard', 35),

  ('branding.view', 'Branding', 'View branding', 'Read branding asset configuration.', 'standard', 36),
  ('branding.edit', 'Branding', 'Edit branding', 'Upload, activate and revert branding assets.', 'elevated', 37),

  ('animations.view', 'Appearance', 'View animations', 'Read the motion configuration.', 'standard', 38),
  ('animations.edit', 'Appearance', 'Edit animations', 'Change motion type, duration, intensity and reduce-motion mode.', 'standard', 39),

  ('theme.view', 'Appearance', 'View theme', 'Read the platform theme configuration.', 'standard', 40),
  ('theme.edit', 'Appearance', 'Edit theme', 'Change platform colours, typography and surface styling.', 'elevated', 41),

  ('errorpages.view', 'Error pages', 'View error pages', 'Read error page configuration.', 'standard', 42),
  ('errorpages.edit', 'Error pages', 'Edit error pages', 'Change error page copy, imagery and buttons.', 'standard', 43),

  ('notifications.view', 'Notifications', 'View notifications', 'Read announcements and system notifications.', 'standard', 44),
  ('notifications.edit', 'Notifications', 'Edit notifications', 'Create, edit, schedule and deactivate announcements.', 'standard', 45),
  ('notifications.send', 'Notifications', 'Send system notifications', 'Send a targeted system notification to accounts.', 'elevated', 46),

  ('ads.view', 'Advertising', 'View ads', 'List advertisements and their metrics.', 'standard', 47),
  ('ads.edit', 'Advertising', 'Edit ads', 'Create, edit, schedule and activate advertisements.', 'elevated', 48),

  ('flags.view', 'Feature flags', 'View feature flags', 'Read feature flag state.', 'standard', 49),
  ('flags.edit', 'Feature flags', 'Edit feature flags', 'Enable, disable, set rollout and restrict flags.', 'elevated', 50),

  ('settings.view', 'Settings', 'View settings', 'Read platform and site settings.', 'standard', 51),
  ('settings.edit', 'Settings', 'Edit settings', 'Change platform, privacy, upload and content settings.', 'elevated', 52),
  ('security.edit', 'Settings', 'Edit security settings', 'Change authentication and security policy settings.', 'critical', 53),
  ('maintenance.edit', 'Settings', 'Change maintenance mode', 'Put the platform into or out of maintenance.', 'critical', 54),

  ('emails.view', 'Email', 'View email templates', 'Read email template metadata and copy.', 'standard', 55),
  ('emails.edit', 'Email', 'Edit email templates', 'Change email template copy and activation.', 'standard', 56),

  ('admins.view', 'Administration', 'View administrators', 'List administrator accounts, roles and sessions.', 'elevated', 57),
  ('admins.create', 'Administration', 'Create administrators', 'Grant administrator access to an account.', 'critical', 58),
  ('admins.disable', 'Administration', 'Disable administrators', 'Suspend or restore an administrator account.', 'critical', 59),
  ('admins.delete', 'Administration', 'Delete administrators', 'Remove administrator access entirely.', 'critical', 60),
  ('roles.edit', 'Administration', 'Edit roles and permissions', 'Change the permission set granted to a role.', 'critical', 61),

  ('audit.view', 'Audit', 'View audit log', 'Read the administrator audit log.', 'elevated', 62),
  ('system.view', 'System', 'View system health', 'Read health, storage and version diagnostics.', 'standard', 63),
  ('system.export', 'System', 'Export configuration', 'Download a non-secret configuration export.', 'elevated', 64),
  ('system.emergency', 'System', 'Emergency mode', 'Trigger the emergency lockdown controls.', 'critical', 65),
  ('messages.view_reports', 'Messaging', 'View message reports', 'Read abuse reports that reference a conversation. Message bodies are never exposed.', 'critical', 66)
on conflict (key) do update
  set category = excluded.category,
      label = excluded.label,
      description = excluded.description,
      risk = excluded.risk,
      sort_order = excluded.sort_order;

-- Super Admin holds every permission. The other four roles get an explicit,
-- auditable subset. Writing these out (rather than deriving them at runtime) keeps
-- the effective permission set inspectable in the Roles screen.
insert into public.admin_role_permissions (role_key, permission_key)
select 'super_admin', key from public.admin_permissions
on conflict do nothing;

insert into public.admin_role_permissions (role_key, permission_key)
values
  -- Admin: platform management minus security configuration, role editing,
  -- administrator lifecycle and emergency mode.
  ('admin', 'users.view'), ('admin', 'users.edit'), ('admin', 'users.verify'),
  ('admin', 'users.restrict'), ('admin', 'users.suspend'), ('admin', 'users.ban'),
  ('admin', 'users.notes'), ('admin', 'users.sessions'), ('admin', 'users.delete'),
  ('admin', 'posts.view'), ('admin', 'posts.hide'), ('admin', 'posts.restore'), ('admin', 'posts.delete'),
  ('admin', 'comments.view'), ('admin', 'comments.hide'), ('admin', 'comments.restore'), ('admin', 'comments.delete'),
  ('admin', 'reports.view'), ('admin', 'reports.update'),
  ('admin', 'cms.view'), ('admin', 'cms.edit'), ('admin', 'cms.publish'), ('admin', 'cms.delete'),
  ('admin', 'navigation.view'), ('admin', 'navigation.edit'),
  ('admin', 'branding.view'), ('admin', 'branding.edit'),
  ('admin', 'animations.view'), ('admin', 'animations.edit'),
  ('admin', 'theme.view'), ('admin', 'theme.edit'),
  ('admin', 'errorpages.view'), ('admin', 'errorpages.edit'),
  ('admin', 'notifications.view'), ('admin', 'notifications.edit'), ('admin', 'notifications.send'),
  ('admin', 'ads.view'), ('admin', 'ads.edit'),
  ('admin', 'flags.view'), ('admin', 'flags.edit'),
  ('admin', 'settings.view'), ('admin', 'settings.edit'), ('admin', 'maintenance.edit'),
  ('admin', 'emails.view'), ('admin', 'emails.edit'),
  ('admin', 'admins.view'),
  ('admin', 'audit.view'),
  ('admin', 'system.view'), ('admin', 'system.export'),

  -- Moderator: users and content moderation only.
  ('moderator', 'users.view'), ('moderator', 'users.restrict'), ('moderator', 'users.suspend'),
  ('moderator', 'users.notes'), ('moderator', 'users.sessions'),
  ('moderator', 'posts.view'), ('moderator', 'posts.hide'), ('moderator', 'posts.restore'), ('moderator', 'posts.delete'),
  ('moderator', 'comments.view'), ('moderator', 'comments.hide'), ('moderator', 'comments.restore'), ('moderator', 'comments.delete'),
  ('moderator', 'reports.view'), ('moderator', 'reports.update'),
  ('moderator', 'flags.view'),
  ('moderator', 'system.view'),

  -- Content Manager: the CMS and everything visual, no user moderation.
  ('content_manager', 'users.view'),
  ('content_manager', 'posts.view'),
  ('content_manager', 'comments.view'),
  ('content_manager', 'cms.view'), ('content_manager', 'cms.edit'),
  ('content_manager', 'cms.publish'), ('content_manager', 'cms.delete'),
  ('content_manager', 'navigation.view'), ('content_manager', 'navigation.edit'),
  ('content_manager', 'branding.view'), ('content_manager', 'branding.edit'),
  ('content_manager', 'animations.view'), ('content_manager', 'animations.edit'),
  ('content_manager', 'theme.view'), ('content_manager', 'theme.edit'),
  ('content_manager', 'errorpages.view'), ('content_manager', 'errorpages.edit'),
  ('content_manager', 'notifications.view'), ('content_manager', 'notifications.edit'),
  ('content_manager', 'ads.view'), ('content_manager', 'ads.edit'),
  ('content_manager', 'flags.view'),
  ('content_manager', 'emails.view'), ('content_manager', 'emails.edit'),
  ('content_manager', 'system.view'),

  -- Support: account diagnostics, almost entirely read-only.
  ('support', 'users.view'), ('support', 'users.notes'), ('support', 'users.sessions'),
  ('support', 'posts.view'), ('support', 'comments.view'),
  ('support', 'reports.view'),
  ('support', 'cms.view'), ('support', 'navigation.view'),
  ('support', 'notifications.view'), ('support', 'notifications.send'),
  ('support', 'flags.view'), ('support', 'settings.view'),
  ('support', 'emails.view'),
  ('support', 'system.view')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Link admin_profiles to the role table
-- ---------------------------------------------------------------------------

alter table public.admin_profiles
  add column if not exists role_key text not null default 'admin',
  add column if not exists must_change_password boolean not null default false,
  add column if not exists password_changed_at timestamptz,
  add column if not exists provisioned_by text not null default 'bootstrap';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'admin_profiles_role_key_fkey'
  ) then
    alter table public.admin_profiles
      add constraint admin_profiles_role_key_fkey
      foreign key (role_key) references public.admin_roles(key) on update cascade;
  end if;
end;
$$;

-- Backfill the new key from the legacy enum before anything reads it.
update public.admin_profiles
   set role_key = case when role = 'super_admin' then 'super_admin' else 'admin' end
 where role_key is distinct from case when role = 'super_admin' then 'super_admin' else 'admin' end;

-- Keep the legacy enum and the new key in agreement in both directions. Existing
-- Edge Function code compares `role = 'super_admin'` directly, so the enum stays
-- authoritative for the two legacy values and the key stays authoritative for the
-- three new roles.
create or replace function public.sync_admin_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role_key = 'super_admin' and new.role <> 'super_admin' then
    new.role := 'super_admin';
  elsif new.role_key <> 'super_admin' and new.role = 'super_admin' and tg_op = 'UPDATE' then
    new.role_key := 'super_admin';
  end if;
  if new.updated_at is null or tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists sync_admin_profile_role on public.admin_profiles;
create trigger sync_admin_profile_role
  before insert or update of role, role_key on public.admin_profiles
  for each row execute function public.sync_admin_profile_role();

-- ---------------------------------------------------------------------------
-- 4. Sessions
-- ---------------------------------------------------------------------------

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revoke_reason text not null default '',
  reauthenticated_at timestamptz,
  user_agent text,
  ip_address inet,
  device_label text not null default 'Unknown device'
);

comment on table public.admin_sessions is
  'Administrator console sessions. A session id is minted at login, returned to the browser, and presented as x-admin-session-id on every later admin request so sessions survive access-token rotation and can be revoked individually.';

create index if not exists admin_sessions_admin_idx on public.admin_sessions (admin_user_id, created_at desc);
create index if not exists admin_sessions_active_idx on public.admin_sessions (admin_user_id) where revoked_at is null;

alter table public.admin_sessions enable row level security;
revoke all on public.admin_sessions from public, anon, authenticated;
grant all on public.admin_sessions to service_role;

-- ---------------------------------------------------------------------------
-- 5. Audit log enrichment
-- ---------------------------------------------------------------------------

alter table public.admin_audit_logs
  add column if not exists reason text not null default '' check (char_length(reason) <= 2000),
  add column if not exists result text not null default 'success' check (result in ('success', 'failure', 'denied'));

create index if not exists admin_audit_logs_action_idx on public.admin_audit_logs (action, created_at desc);
create index if not exists admin_audit_logs_target_idx on public.admin_audit_logs (target_type, target_id);
create index if not exists admin_audit_logs_admin_idx on public.admin_audit_logs (admin_user_id, created_at desc);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);

revoke all on public.admin_audit_logs from public, anon, authenticated;
grant all on public.admin_audit_logs to service_role;

-- ---------------------------------------------------------------------------
-- 6. Administrator role resolution RPC
-- ---------------------------------------------------------------------------

create or replace function public.admin_permissions_for_role(p_role_key text)
returns setof text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select permission_key from public.admin_role_permissions where role_key = p_role_key;
$$;

create or replace function public.admin_effective_permissions(p_user_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select rp.permission_key
    from public.admin_profiles ap
    join public.admin_role_permissions rp on rp.role_key = ap.role_key
   where ap.user_id = p_user_id
     and ap.is_active;
$$;

revoke all on function public.admin_permissions_for_role(text) from public, anon, authenticated;
revoke all on function public.admin_effective_permissions(uuid) from public, anon, authenticated;
grant execute on function public.admin_permissions_for_role(text) to service_role;
grant execute on function public.admin_effective_permissions(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Browser read boundary for the admin-controlled configuration tables
-- ---------------------------------------------------------------------------
--
-- These four tables are read directly by the public app (src/lib/feature-flags.tsx,
-- src/app/shell.tsx navigation + announcements, src/app/views.tsx CMS route
-- dispatcher). They had no grant and no policy for anon/authenticated, so every read
-- failed and the app silently used compiled defaults. The policies below are
-- read-only, minimal, and deliberately exclude draft or inactive rows.

grant usage on schema public to anon, authenticated;
grant select on public.feature_flags to anon, authenticated;
grant select on public.navigation_items to anon, authenticated;
grant select on public.system_announcements to anon, authenticated;
grant select on public.cms_pages to anon, authenticated;

drop policy if exists "Public reads feature flags" on public.feature_flags;
create policy "Public reads feature flags" on public.feature_flags
  for select to anon, authenticated
  using (true);

drop policy if exists "Public reads public navigation" on public.navigation_items;
create policy "Public reads public navigation" on public.navigation_items
  for select to anon
  using (visible and required_role = 'all');

drop policy if exists "Signed-in reads role navigation" on public.navigation_items;
create policy "Signed-in reads role navigation" on public.navigation_items
  for select to authenticated
  using (
    visible
    and (
      required_role = 'all'
      or exists (
        select 1
          from public.admin_profiles ap
         where ap.user_id = auth.uid()
           and ap.is_active
           and ap.role_key = navigation_items.required_role
      )
    )
  );

drop policy if exists "Public reads live announcements" on public.system_announcements;
create policy "Public reads live announcements" on public.system_announcements
  for select to anon, authenticated
  using (
    active
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
  );

drop policy if exists "Public reads published pages" on public.cms_pages;
create policy "Public reads published pages" on public.cms_pages
  for select to anon, authenticated
  using (
    status = 'published'
    and (published_at is null or published_at <= now())
  );

-- ---------------------------------------------------------------------------
-- 8. Legacy administrator revocation ledger
-- ---------------------------------------------------------------------------
--
-- Records which administrator identities were retired by the credential migration so
-- the revocation is auditable and repeatable rather than a one-off manual step.

create table if not exists public.admin_credential_migrations (
  id uuid primary key default gen_random_uuid(),
  legacy_user_id uuid references auth.users(id) on delete set null,
  legacy_email text not null default '',
  action text not null check (action in ('disabled', 'deleted', 'session_revoked', 'superseded')),
  reason text not null default '',
  performed_by uuid references auth.users(id) on delete set null,
  performed_at timestamptz not null default now()
);

alter table public.admin_credential_migrations enable row level security;
revoke all on public.admin_credential_migrations from public, anon, authenticated;
grant all on public.admin_credential_migrations to service_role;

-- ---------------------------------------------------------------------------
-- 9. RBAC tables stay service-role only; the browser never reads them directly.
-- ---------------------------------------------------------------------------

alter table public.admin_roles enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.admin_role_permissions enable row level security;

revoke all on public.admin_roles from public, anon, authenticated;
revoke all on public.admin_permissions from public, anon, authenticated;
revoke all on public.admin_role_permissions from public, anon, authenticated;
grant all on public.admin_roles to service_role;
grant all on public.admin_permissions to service_role;
grant all on public.admin_role_permissions to service_role;
