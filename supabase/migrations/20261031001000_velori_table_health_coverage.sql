-- Widen the administrator table-health check to every managed table.
--
-- admin_table_health() only inspected the ten core content and admin foundation
-- tables, so the console reported "10 managed tables reported healthy" on a
-- database that carries 78 public tables. Sixty-eight tables could disappear
-- without any signal, and the diagnosis text pointed at the core migration even
-- for console relations that only later migrations create.
--
-- The function now reports every table the migration chain creates and names the
-- exact migration file that installs it, so "degraded" is actionable. Callers
-- read the row set generically, so no consumer changes shape.

create or replace function public.admin_table_health()
returns table (name text, ok boolean, diagnosis text)
language sql
security definer
set search_path = ''
as $$
  select
    managed.name,
    to_regclass('public.' || managed.name) is not null,
    case
      when to_regclass('public.' || managed.name) is not null then null
      else 'Apply supabase/migrations/' || managed.migration || '.'
    end
  from (values
    ('comments', '20261001000000_velori_core.sql'),
    ('likes', '20261001000000_velori_core.sql'),
    ('post_tags', '20261001000000_velori_core.sql'),
    ('posts', '20261001000000_velori_core.sql'),
    ('profiles', '20261001000000_velori_core.sql'),
    ('saves', '20261001000000_velori_core.sql'),
    ('admin_audit_logs', '20261002000000_veloryz_admin.sql'),
    ('admin_login_attempts', '20261002000000_veloryz_admin.sql'),
    ('admin_profiles', '20261002000000_veloryz_admin.sql'),
    ('site_settings', '20261002000000_veloryz_admin.sql'),
    ('admin_access_code', '20261007000000_veloryz_admin_bootstrap_claim.sql'),
    ('admin_bootstrap_claims', '20261007000000_veloryz_admin_bootstrap_claim.sql'),
    ('account_modes', '20261009000000_velori_platform_core.sql'),
    ('account_settings', '20261009000000_velori_platform_core.sql'),
    ('blocks', '20261009000000_velori_platform_core.sql'),
    ('close_friends', '20261009000000_velori_platform_core.sql'),
    ('follows', '20261009000000_velori_platform_core.sql'),
    ('hidden_authors', '20261009000000_velori_platform_core.sql'),
    ('mutes', '20261009000000_velori_platform_core.sql'),
    ('profile_links', '20261009000000_velori_platform_core.sql'),
    ('reserved_usernames', '20261009000000_velori_platform_core.sql'),
    ('restrictions', '20261009000000_velori_platform_core.sql'),
    ('story_hides', '20261009000000_velori_platform_core.sql'),
    ('post_draft_media', '20261010000000_velori_post_lifecycle.sql'),
    ('post_drafts', '20261010000000_velori_post_lifecycle.sql'),
    ('post_media', '20261010000000_velori_post_lifecycle.sql'),
    ('admin_error_pages', '20261012000000_velori_admin_content_management.sql'),
    ('cms_page_versions', '20261012000000_velori_admin_content_management.sql'),
    ('cms_pages', '20261012000000_velori_admin_content_management.sql'),
    ('content_reports', '20261012000000_velori_admin_content_management.sql'),
    ('feature_flags', '20261012000000_velori_admin_content_management.sql'),
    ('navigation_items', '20261012000000_velori_admin_content_management.sql'),
    ('system_announcements', '20261012000000_velori_admin_content_management.sql'),
    ('admin_credential_migrations', '20261013000000_velori_admin_rbac.sql'),
    ('admin_permissions', '20261013000000_velori_admin_rbac.sql'),
    ('admin_role_permissions', '20261013000000_velori_admin_rbac.sql'),
    ('admin_roles', '20261013000000_velori_admin_rbac.sql'),
    ('admin_sessions', '20261013000000_velori_admin_rbac.sql'),
    ('advertisements', '20261014000000_velori_admin_console.sql'),
    ('animation_configs', '20261014000000_velori_admin_console.sql'),
    ('app_routes', '20261014000000_velori_admin_console.sql'),
    ('branding_asset_versions', '20261014000000_velori_admin_console.sql'),
    ('branding_assets', '20261014000000_velori_admin_console.sql'),
    ('email_template_configs', '20261014000000_velori_admin_console.sql'),
    ('email_template_versions', '20261014000000_velori_admin_console.sql'),
    ('platform_settings', '20261014000000_velori_admin_console.sql'),
    ('system_notification_receipts', '20261014000000_velori_admin_console.sql'),
    ('system_notifications', '20261014000000_velori_admin_console.sql'),
    ('theme_settings', '20261014000000_velori_admin_console.sql'),
    ('notification_preferences', '20261015000000_velori_social_product_infra.sql'),
    ('notifications', '20261015000000_velori_social_product_infra.sql'),
    ('reel_comments', '20261015000000_velori_social_product_infra.sql'),
    ('reel_drafts', '20261015000000_velori_social_product_infra.sql'),
    ('reel_likes', '20261015000000_velori_social_product_infra.sql'),
    ('reel_media', '20261015000000_velori_social_product_infra.sql'),
    ('reel_reports', '20261015000000_velori_social_product_infra.sql'),
    ('reel_saves', '20261015000000_velori_social_product_infra.sql'),
    ('reel_settings', '20261015000000_velori_social_product_infra.sql'),
    ('reels', '20261015000000_velori_social_product_infra.sql'),
    ('stories', '20261015000000_velori_social_product_infra.sql'),
    ('story_media', '20261015000000_velori_social_product_infra.sql'),
    ('story_replies', '20261015000000_velori_social_product_infra.sql'),
    ('story_reports', '20261015000000_velori_social_product_infra.sql'),
    ('story_settings', '20261015000000_velori_social_product_infra.sql'),
    ('story_views', '20261015000000_velori_social_product_infra.sql'),
    ('motion_configuration', '20261018000000_velori_motion_experience_cms.sql'),
    ('motion_presets', '20261018000000_velori_motion_experience_cms.sql'),
    ('motion_versions', '20261018000000_velori_motion_experience_cms.sql'),
    ('conversation_participants', '20261019000000_velori_messaging_and_groups.sql'),
    ('conversations', '20261019000000_velori_messaging_and_groups.sql'),
    ('group_members', '20261019000000_velori_messaging_and_groups.sql'),
    ('group_settings', '20261019000000_velori_messaging_and_groups.sql'),
    ('groups', '20261019000000_velori_messaging_and_groups.sql'),
    ('message_attachments', '20261019000000_velori_messaging_and_groups.sql'),
    ('messages', '20261019000000_velori_messaging_and_groups.sql'),
    ('ad_events', '20261020000000_velori_ad_events_and_reel_story_moderation.sql'),
    ('admin_accounts', '20261025000000_veloryz_admin_accounts.sql'),
    ('motion_publication_events', '20261030000000_velori_page_experience_runtime.sql')
  ) as managed(name, migration);
$$;

comment on function public.admin_table_health() is
  'Reports whether every table the VELORI migration chain creates is installed, naming the migration that creates each one.';

revoke all on function public.admin_table_health() from public, anon, authenticated;
grant execute on function public.admin_table_health() to service_role;
